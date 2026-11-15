# CareCircle — Care, Connected. Every Day.

A modern, production-oriented healthcare management web application designed for elderly individuals, their family members, and caretakers.

---

## 1. Executive Summary & Problem Statement

Managing multiple daily medications, clinical visits, and daily routines can be overwhelming for elderly individuals living independently. Traditional reminder apps are often cluttered, isolated, and fail to keep the family or professional caretakers in the loop.

**CareCircle** bridges this gap by creating an interconnected healthcare ecosystem:

- **Elderly-First Design:** Features a dedicated **Senior Mode** with 52–64px touch targets, high-contrast typography, simplified cards, and text-to-speech Web Speech API audio assistance.
- **Passcode-Based Shared Access:** No shared credentials. Authorized caretakers and family members join via single-use 8-digit random numeric passcodes with 15-minute expiration windows, hashed with cryptographic salts (HMAC-SHA256).
- **Medication & Adherence Engine:** Full CRUD for medications, frequencies, and dosage times. Records taken, skipped, and missed doses with user attribution and concurrency protection.
- **Smart Notification Engine:** Automated background reminder engine detecting upcoming doses (15–30m window), missed doses (grace period expiration), and doctor appointments (24h and 2h lead times) sending transactional HTML emails via Resend with database idempotency protection.
- **Caregiver Handover Notes & Care Timeline:** Chronological shifts, notes, and activity feed logging who updated what and when.
- **Strict Vercel Architecture:** 100% serverless Next.js App Router code ready for Vercel deployment with MongoDB Atlas persistent storage.

---

## 2. Technology Stack

| Layer              | Technology                     | Details                                                                                           |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Frontend**       | Next.js 14 (App Router)        | React Server Components & Client Components                                                       |
| **Language**       | TypeScript                     | Strict mode enabled, zero `any` policy                                                            |
| **Styling & UI**   | Tailwind CSS & Lucide Icons    | Custom palette (Navy `#0F172A`, Sage `#10B981`, Teal `#0D9488`, Amber `#F59E0B`, Coral `#F43F5E`) |
| **Accessibility**  | Senior Mode & Speech Synthesis | WCAG 2.2 AA target, Web Speech API audio read-aloud                                               |
| **Database**       | MongoDB Atlas / Node Driver    | Connection pool caching, indexed collections                                                      |
| **Authentication** | Stateless JWT (jose)           | HttpOnly, SameSite=Lax, Secure cookies, bcryptjs (10 rounds)                                      |
| **Email Delivery** | Resend                         | Professional HTML templates, idempotent delivery records                                          |
| **Scheduling**     | Vercel Cron & Route Handlers   | `vercel.json` recurring dispatcher (`/api/cron/dispatch-reminders`)                               |
| **Testing**        | Vitest                         | Unit, integration, schema validation, and reminder tests                                          |
| **Code Quality**   | Prettier & ESLint              | Next.js core web vitals and strict formatting                                                     |

---

## 3. Database Schema Overview

The database uses MongoDB with the following collections and primary indexes:

1. **`users`**
   - Fields: `_id`, `name`, `email`, `passwordHash`, `emailVerified`, `defaultRole`, `seniorModeEnabled`, `activeProfileId`, `createdAt`, `updatedAt`
   - Indexes: `{ email: 1 }` (unique)

2. **`elderlyProfiles`**
   - Fields: `_id`, `ownerUserId`, `fullName`, `preferredName`, `dateOfBirth`, `gender`, `emergencyContact`, `notes`, `timezone`, `createdAt`, `updatedAt`
   - Indexes: `{ ownerUserId: 1 }`

3. **`careCircleMembers`**
   - Fields: `_id`, `elderlyProfileId`, `userId`, `userEmail`, `userName`, `role`, `relationshipToElderly`, `permissions`, `status`, `invitedByUserId`, `joinedAt`, `updatedAt`
   - Indexes: `{ elderlyProfileId: 1, userId: 1 }` (unique), `{ userId: 1 }`

4. **`invitationCodes`**
   - Fields: `_id`, `elderlyProfileId`, `elderlyName`, `role`, `relationship`, `permissions`, `codeHash`, `salt`, `codeHint`, `createdByUserId`, `createdByName`, `expiresAt`, `maxUses`, `usesCount`, `status`, `failedAttempts`, `createdAt`
   - Indexes: `{ codeHash: 1 }`, `{ elderlyProfileId: 1 }`, `{ expiresAt: 1 }` (TTL expiration)

5. **`medications`**
   - Fields: `_id`, `elderlyProfileId`, `name`, `dosage`, `form`, `instructions`, `frequency`, `scheduledTimes`, `startDate`, `endDate`, `status`, `reminderMinutesBefore`, `notes`, `prescribingDoctor`, `color`, `createdByUserId`, `createdAt`, `updatedAt`
   - Indexes: `{ elderlyProfileId: 1, status: 1 }`

6. **`doseLogs`**
   - Fields: `_id`, `elderlyProfileId`, `medicationId`, `medicationName`, `dosage`, `form`, `instructions`, `scheduledDate`, `scheduledTime`, `scheduledDateTime`, `status`, `recordedAt`, `recordedByUserId`, `recordedByName`, `recordedRole`, `notes`, `gracePeriodMinutes`, `missedAlertSent`, `upcomingReminderSent`, `createdAt`, `updatedAt`
   - Indexes: `{ medicationId: 1, scheduledDateTime: 1 }` (unique), `{ elderlyProfileId: 1, scheduledDate: 1 }`, `{ status: 1, scheduledDateTime: 1 }`

7. **`appointments`**
   - Fields: `_id`, `elderlyProfileId`, `doctorName`, `specialty`, `hospitalClinicName`, `appointmentDate`, `appointmentTime`, `location`, `reason`, `notes`, `followUpDate`, `preparationChecklist`, `status`, `remindersSent`, `createdByUserId`, `createdByName`, `createdAt`, `updatedAt`
   - Indexes: `{ elderlyProfileId: 1, appointmentDate: 1 }`, `{ status: 1 }`

8. **`careNotes`**
   - Fields: `_id`, `elderlyProfileId`, `authorUserId`, `authorName`, `authorRole`, `category`, `content`, `createdAt`, `updatedAt`
   - Indexes: `{ elderlyProfileId: 1, createdAt: -1 }`

9. **`auditLogs`**
   - Fields: `_id`, `elderlyProfileId`, `actorUserId`, `actorName`, `actorEmail`, `action`, `details`, `ipAddress`, `userAgent`, `createdAt`
   - Indexes: `{ elderlyProfileId: 1, createdAt: -1 }`, `{ actorUserId: 1 }`

10. **`notificationPreferences`**
    - Fields: `_id`, `elderlyProfileId`, `userId`, `userEmail`, `userName`, `emailUpcomingDoses`, `emailMissedDoses`, `emailAppointments`, `emailHandoverNotes`, `updatedAt`
    - Indexes: `{ elderlyProfileId: 1, userId: 1 }` (unique)

11. **`reminderDeliveries`**
    - Fields: `_id`, `elderlyProfileId`, `referenceType`, `referenceId`, `recipientUserId`, `recipientEmail`, `idempotencyKey`, `status`, `attempts`, `sentAt`, `error`, `createdAt`
    - Indexes: `{ idempotencyKey: 1 }` (unique)

---

## 4. Environment Variables

Create `.env.local` or configure in Vercel Project Settings:

```env
# Application
NEXT_PUBLIC_APP_NAME=CareCircle
APP_URL=https://carecircle.vercel.app
NODE_ENV=production

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=carecircle

# Authentication Secret (32+ chars)
AUTH_SECRET=carecircle-super-secret-production-key-32-chars-min!

# Resend Transactional Email
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=CareCircle <notifications@yourdomain.com>

# Vercel Cron Security Token
CRON_SECRET=carecircle_cron_secure_token_secret
```

> **Note on Local Development without Resend Credentials:**
> When `RESEND_API_KEY` is omitted, the email engine safely logs outgoing emails to the console and records delivery records as `skipped` with clear notes, preventing false delivery assertions.

---

## 5. Local Setup & Execution

1. **Clone and install dependencies:**

   ```bash
   git clone <repo-url>
   cd CARECIRCLE
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env.local
   # Update MONGODB_URI and AUTH_SECRET as needed
   ```

3. **Run quality verification checks:**

   ```bash
   npm run typecheck      # TypeScript strict compilation check
   npm run lint           # ESLint verification
   npm run format:check   # Prettier format verification
   npm run test           # Vitest automated test suite
   ```

4. **Start local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## 6. Vercel Deployment Instructions

CareCircle is built specifically for zero-configuration Vercel serverless deployment:

1. **Push code to GitHub/GitLab.**
2. **Import repository into Vercel.**
3. **Configure Environment Variables in Vercel:**
   - `MONGODB_URI`: Connection string to MongoDB Atlas.
   - `MONGODB_DB`: `carecircle`.
   - `AUTH_SECRET`: Random 32+ character string.
   - `RESEND_API_KEY`: Your Resend API key.
   - `EMAIL_FROM`: Verified sender email address.
   - `CRON_SECRET`: Random secret for Vercel Cron authorization.
4. **Deploy:**
   Vercel automatically detects the Next.js project and schedules the recurring reminder engine via `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/dispatch-reminders",
         "schedule": "*/5 * * * *"
       }
     ]
   }
   ```

---

## 7. Interactive Demo Accounts

To test the multi-user role-based collaboration, use the quick demo sign-in buttons on the sign-in page:

1. **Elderly Individual (Profile Owner):**
   - Email: `eleanor.vance@carecircle.demo`
   - Password: `CareCircle2026!`
   - Role: Profile Owner with Senior Mode enabled. Can confirm taken doses, manage medication schedules, and generate 8-digit invitation codes.

2. **Caretaker / Visiting Nurse:**
   - Email: `nurse.clara@carecircle.demo`
   - Password: `CareCircle2026!`
   - Role: Caretaker. Can record doses on behalf of Eleanor, leave handover shift notes, and manage clinic appointments.

3. **Family Member (Son):**
   - Email: `david.vance@carecircle.demo`
   - Password: `CareCircle2026!`
   - Role: Family Member. Monitors adherence trends, views missed medication warnings, and stays informed via email alerts.

---

## 8. Medical & Legal Safety Notice

CareCircle is an assistive operational management and reminder platform. It does not provide medical diagnoses, treatment recommendations, or alter medication dosages. Always consult qualified physicians or pharmacists for medical advice.
