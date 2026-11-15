# CareCircle — Production Signup Error Investigation & Resolution Report

**Date:** November 15, 2026  
**Incident:** `POST /api/auth/signup` returning HTTP 500 Internal Server Error in Vercel Production  
**Frontend User Message:** `"An unexpected error occurred during signup."`  
**Status:** Remediated & Verified

---

## 1. Actual Root Cause Analysis

From the Vercel production logs provided:

```
Error ensuring indexes:
Error: querySrv ENOTFOUND _mongodb._tcp.23Db
```

### What Happened

1. The MongoDB Node.js driver uses DNS SRV queries to discover replica set members when connecting to a MongoDB Atlas cluster (`mongodb+srv://...`).
2. When the driver attempts to resolve the SRV record, it issues a DNS query formatted as `_mongodb._tcp.<hostname>`.
3. In production, the driver attempted to resolve: `_mongodb._tcp.23Db`.
4. The hostname parsed by the driver was **`23Db`** rather than the Atlas cluster hostname (`cluster0.xxxx.mongodb.net`).
5. **Exact Mechanism of Failure**:
   In standard MongoDB connection URIs:
   `mongodb+srv://<username>:<password>@<cluster-host>/<database>?<options>`
   The driver splits the authority section by `@` to separate user credentials from the hostname.
   If the database password contains special characters (specifically an unencoded `@` symbol, e.g., `santhoshdesu23:my@password` or `santhoshdesu23:secret@23Db...`), the driver treats everything before the final `@` as user credentials, and misinterprets the characters following the `@` as the host.
   Alternatively, if `MONGODB_URI` in the Vercel dashboard environment variables had a typo, line break, or truncation where the hostname was entered as `23Db` or `cluster0...23Db`, the DNS lookup failed immediately with `querySrv ENOTFOUND`.
6. When `POST /api/auth/signup` was called:
   - Line 18 called `await ensureDatabaseIndexes()`.
   - The connection failed with `querySrv ENOTFOUND _mongodb._tcp.23Db`.
   - The route handler caught this error and fell through to a generic `500 Internal Server Error` response with message `"An unexpected error occurred during signup."`.

---

## 2. Exact Failing Operation Sequence

1. User submitted the signup form (`POST /api/auth/signup`).
2. Request reached `app/api/auth/signup/route.ts`.
3. The route invoked `ensureDatabaseIndexes()`.
4. `ensureDatabaseIndexes()` called `getUsersCollection()`, which called `getDatabase()` in `lib/database/client.ts`.
5. `MongoClient.connect()` attempted SRV DNS discovery for `_mongodb._tcp.23Db`.
6. DNS lookup failed with `ENOTFOUND`.
7. Connection promise rejected. In the previous implementation, the rejected promise was cached, causing all subsequent database operations to immediately fail without reattempting connection.
8. Uncaught database rejection propagated to the top-level catch block in `route.ts`, responding with HTTP 500.

---

## 3. Files Modified

| File                                 | Nature of Changes                                                                                                                                                      |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/database/client.ts`             | Added safe URI sanitization, credential-safe diagnostic parsing, unencoded `@` detection, and singleton connection pool promise reset on failure                       |
| `lib/database/indexes.ts`            | Added singleton promise lock to prevent duplicate concurrent index runs, structured error logging, and clean diagnostic failure reporting                              |
| `types/index.ts`                     | Added `UserAccountStatus` (`pending_verification`, `active`, `disabled`) and `emailVerificationExpires` to `User`                                                      |
| `app/api/auth/signup/route.ts`       | Complete refactor: 503 on database unavailability, 409 on duplicate, Brevo email failure isolation, unverified account recovery state machine, correlation request IDs |
| `app/api/auth/signin/route.ts`       | Added 403 check for disabled accounts and 503 response for database unavailability                                                                                     |
| `app/api/auth/verify-email/route.ts` | New verification redemption endpoint supporting both GET (email link) and POST (API)                                                                                   |
| `.prettierrc`                        | Added `"endOfLine": "auto"` to harmonize cross-platform CRLF/LF linting                                                                                                |
| `tests/mongo-client.test.ts`         | Unit tests for MongoDB diagnostic parser, URI sanitization, unencoded `@` detection, and quote stripping                                                               |
| `tests/signup-flow.test.ts`          | Integration test suite covering 17 distinct scenarios across database failures, Brevo failures, and recovery flows                                                     |

---

## 4. Fix Implemented

### A. Safe MongoDB Connection Management (`lib/database/client.ts`)

1. **Accidental Quote & Whitespace Stripping**:
   `raw.trim().replace(/^["']|["']$/g, '')` ensures that accidental quotes added in Vercel dashboard environment variables do not corrupt the URI.
2. **Credential-Safe Diagnostic Logging**:
   `getMongoDiagnosticInfo()` extracts the scheme (`mongodb+srv`) and hostname (`cluster0.xxxx.mongodb.net`) without ever logging or exposing passwords, usernames, or connection strings.
3. **Unencoded `@` Detection**:
   Checks whether more than one `@` symbol exists in the authority segment. If detected, outputs an explicit warning informing the operator that passwords with `@` must be URL-encoded (e.g. `%40`) to prevent host misparsing.
4. **Serverless Connection Pooling & Reconnection**:
   Reuses `globalThis._mongoClientPromise` across warm serverless functions. If a connection fails (e.g., DNS error, ENOTFOUND), the promise is explicitly cleared (`globalThis._mongoClientPromise = null`), allowing subsequent requests to reconnect once the environment variable is corrected in Vercel.

### B. Index Initialization Safety (`lib/database/indexes.ts`)

- Added `indexesPromise` singleton guard so concurrent requests do not spawn redundant index creation operations.
- Diagnostic logging outputs clear error messages without secrets.

### C. Registration State Machine & Brevo Email Failure Isolation (`app/api/auth/signup/route.ts`)

1. **Never 500 on Email Provider Issues**:
   If Brevo returns 401 Unauthorized, 429 Rate Limit, or network timeout, the newly created account is **not deleted or corrupted**. The user account is saved with `status: 'pending_verification'` and the API returns HTTP 201 Created with `emailDelivery: { status: 'failed' }` and a message allowing the user to resend verification.
2. **Unverified Account Recovery (Preventing Orphan State)**:
   If a user previously signed up but did not receive or click their verification email, submitting the signup form again with their credentials:
   - Validates their password.
   - Refreshes their verification token and 24-hour expiration window.
   - Resends the verification email via Brevo.
   - Returns HTTP 200 OK instead of an unresolvable 409 lockout.
3. **Appropriate HTTP Status Codes**:
   - `400`: Zod validation error or malformed JSON payload.
   - `403`: Account disabled by administration.
   - `409`: Active account already exists with that email.
   - `429`: IP rate limit exceeded (10 attempts per 15 minutes).
   - `503`: Database service unavailable (`DATABASE_UNAVAILABLE`).
   - `500`: Truly unexpected internal errors with correlation `requestId`.

---

## 5. Database Verification

Tested against MongoDB connection failure simulations:

- When MongoDB throws `MongoServerSelectionError` or `ENOTFOUND`, the API returns HTTP 503 with:
  ```json
  {
    "error": "The database service is temporarily unavailable. Please try again shortly.",
    "code": "DATABASE_UNAVAILABLE",
    "requestId": "req_..."
  }
  ```
- No internal stack traces, database URIs, or usernames are leaked to the client.
- The connection promise is safely cleared for subsequent attempts.

---

## 6. Brevo Verification

- Verification emails are dispatched using `sendAccountVerificationEmail` via Brevo.
- If Brevo fails (timeout, rate limit, or invalid key), the account is securely created in the `pending_verification` state.
- The user is notified gracefully, preventing the orphan account trap.

---

## 7. Automated Testing Results

Vitest executed across **13 test files** with **73 total tests**:

| Test Suite                      | Total Tests | Outcome      |
| :------------------------------ | :---------- | :----------- |
| `tests/signup-flow.test.ts`     | 17 tests    | **ALL PASS** |
| `tests/mongo-client.test.ts`    | 6 tests     | **ALL PASS** |
| `tests/email-reminders.test.ts` | 14 tests    | **ALL PASS** |
| `tests/auth.test.ts`            | 5 tests     | **ALL PASS** |
| `tests/authorization.test.ts`   | 4 tests     | **ALL PASS** |
| `tests/schedules.test.ts`       | 7 tests     | **ALL PASS** |
| `tests/validations.test.ts`     | 5 tests     | **ALL PASS** |
| `tests/permissions.test.ts`     | 3 tests     | **ALL PASS** |
| `tests/invitations.test.ts`     | 3 tests     | **ALL PASS** |
| `tests/doses.test.ts`           | 3 tests     | **ALL PASS** |
| `tests/timezone.test.ts`        | 3 tests     | **ALL PASS** |
| `tests/concurrency.test.ts`     | 2 tests     | **ALL PASS** |
| `tests/seed-security.test.ts`   | 1 test      | **ALL PASS** |

---

## 8. Quality & Production Build Results

| Check                     | Command                              | Result                                 |
| :------------------------ | :----------------------------------- | :------------------------------------- |
| **TypeScript Validation** | `npm run typecheck` (`tsc --noEmit`) | **0 Errors**                           |
| **ESLint Check**          | `npm run lint` (`eslint .`)          | **0 Warnings / 0 Errors**              |
| **Prettier Formatting**   | `npm run format:check`               | **100% Compliant**                     |
| **Production Build**      | `npm run build` (Next.js Turbopack)  | **34/34 Routes Compiled Successfully** |
| **Security Audit**        | `npm audit --omit=dev`               | **0 Vulnerabilities**                  |

---

## 9. Required Action in Vercel Dashboard

To complete resolution in production, the project owner should update the `MONGODB_URI` environment variable in Vercel:

1. Go to **Vercel Dashboard** → **CareCircle** → **Settings** → **Environment Variables**.
2. Locate `MONGODB_URI`.
3. Check the connection string format:
   - Ensure it starts with `mongodb+srv://`.
   - Ensure the hostname matches your Atlas cluster (e.g. `cluster0.abcde.mongodb.net`, NOT `23Db`).
   - If your database user password contains special characters (especially `@`, `:`, `/`, or `%`), URL-encode them. (For example, replace `@` with `%40`, `:` with `%3A`).
   - Remove any wrapping quotes or trailing whitespace.
4. Click **Save**.
5. Trigger a **Redeploy** of the latest production deployment (Deployments → Latest → Redeploy) so the running serverless lambdas pick up the corrected variable.
