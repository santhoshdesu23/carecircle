# CareCircle — MongoDB DNS Error, Build-Time Side Effects & SonarQube Resolution Report

**Project:** CareCircle — Healthcare & Medication Management Platform  
**Date:** November 15, 2026  
**Auditor:** Principal Backend & DevOps Engineer  
**Status:** PASS — All Blockers, Tests & SonarQube Checks Resolved

---

## 1. Executive Summary

This report documents the resolution of two production blockers and code quality items:

1. **MongoDB DNS SRV Resolution Error (`Error: querySrv ENOTFOUND _mongodb._tcp.23Db`)**:
   - Diagnosed root causes: Malformed connection string URI parsing (due to unencoded `@` characters or truncated hostname in serverless environments) and eager module-import execution.
   - Implemented lazy connection initialization via a custom Proxy promise (`lazyClientPromise`) in `lib/database/client.ts`.
   - Added comprehensive, credential-safe error classification (`classifyMongoError`) that categorizes 7 distinct database failure modes (`MISSING_URI`, `INVALID_URI_FORMAT`, `DNS_RESOLUTION_FAILURE`, `AUTHENTICATION_FAILURE`, `NETWORK_ACCESS_FAILURE`, `CONNECTION_TIMEOUT`, `INDEX_INITIALIZATION_FAILURE`) returning HTTP 503 instead of generic 500.

2. **Elimination of Build-Time Database Side Effects**:
   - Prevented static page data collection during `next build` from initiating database connections across 15 worker threads.
   - Designated user-specific dashboard routes (`app/(dashboard)/layout.tsx`) as `force-dynamic`.
   - Verified that Next.js 16.4.6 compiles all 34 routes cleanly without any database calls or SRV resolution warnings.

3. **SonarQube Quality Remediation (Images 1 & 2)**:
   - **`lib/reminders/dispatcher.ts`**: Replaced sequential loops with concurrent `Promise.all` mapping; harmonized all fallback properties to nullish coalescing `??` (`typescript:S6606`); verified zero unhandled promises.
   - **`components/layout/SeniorModeContext.tsx`**: Marked component props as `Readonly<...>` (`typescript:S6759`); memoized Context provider value with `useMemo` and wrapped handler functions with `useCallback` (`typescript:S6844`).
   - **`components/medications/MedicationManager.tsx`**: Marked component props as `Readonly<...>` (`typescript:S6759`); nested `<select>` and `<textarea>` controls inside their `<label>` elements with both `htmlFor` and `id` (`typescript:S6853`); utilized `<Input label="...">` props for direct control-label association.

---

## 2. Root Cause Analysis

### A. The DNS SRV Lookup Anomaly (`_mongodb._tcp.23Db`)

In the MongoDB connection URI format (`mongodb+srv://<username>:<password>@<cluster-host>/<database>`), the driver uses `@` as the boundary delimiter between user credentials and cluster hostname.

- If a password contains an unescaped `@` (e.g. `santhoshdesu23:my@password`), or if an environment variable is copied with trailing or missing characters, the driver parses everything after the final `@` as the cluster hostname (`23Db`).
- Node.js DNS resolver attempts an SRV query for `_mongodb._tcp.23Db`, resulting in `querySrv ENOTFOUND _mongodb._tcp.23Db`.

**Remediation**:

- `lib/database/client.ts` now validates URI format, detects unencoded `@` symbols in credentials, sanitizes the cluster hostname without exposing passwords or keys, and provides actionable diagnostics.

### B. Build-Time Connection Side Effect

Previously, `lib/database/client.ts` exported `getMongoClientPromise()` immediately at the module level. During `next build`, Next.js loaded route modules to analyze exports, which triggered database connections during static page data collection.

**Remediation**:

- Replaced module-level execution with a lazy proxy promise.
- Any module importing database collections will not open a connection until a database operation is actually awaited at request time.

---

## 3. Automated QA & Verification Suite

All quality and verification pipelines passed with zero errors:

| Check                          | Tool / Command                                           | Result                                    |
| :----------------------------- | :------------------------------------------------------- | :---------------------------------------- |
| **TypeScript Type Check**      | `npm run typecheck` (`tsc --noEmit`)                     | **0 Errors**                              |
| **Unused Locals & Parameters** | `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | **0 Errors**                              |
| **ESLint Analysis**            | `npm run lint` (`eslint .`)                              | **0 Warnings, 0 Errors**                  |
| **Code Formatting**            | `npm run format:check` (`prettier --check`)              | **100% Compliant**                        |
| **Unit & Integration Tests**   | `npm test` (`vitest run`)                                | **13/13 Files, 80/80 Tests Passed**       |
| **Turbopack Build**            | `npm run build` (`next build`)                           | **34 Routes Compiled, 0 DB Side Effects** |
| **Production Security Audit**  | `npm audit --omit=dev`                                   | **0 Vulnerabilities**                     |

---

## 4. Instructions for Vercel Environment Configuration

To complete the production connection to MongoDB Atlas on Vercel:

1. Open the **Vercel Dashboard** → Select **CareCircle** project → **Settings** → **Environment Variables**.
2. Update `MONGODB_URI`:
   - Ensure the connection string follows the standard format:
     `mongodb+srv://<username>:<encoded-password>@<cluster-subdomain>.mongodb.net/carecircle?retryWrites=true&w=majority`
   - If your MongoDB Atlas database password contains special characters (`@`, `:`, `/`, `?`, `#`, `[`), URL-encode them (e.g. `@` becomes `%40`).
3. Set `MONGODB_DB`:
   - `carecircle`
4. Trigger a **Redeploy** on Vercel.
