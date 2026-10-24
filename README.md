# HCM Lite — Saylani Hackathon

AI-assisted HR system for **Admin, HR and Employee**: org setup, employees + CSV import, web attendance, leave with approval, Payroll Lite with PDF payslips, dashboards, AI assistant (Gemini tool calling), announcements, notifications and audit log. Starts empty — no dummy data.

**Stack:** Next.js (App Router, JavaScript only) · Tailwind CSS · Firebase Authentication · Cloud Firestore · Gemini API · Recharts · jsPDF · PapaParse.
Backend = Next.js API route handlers (`src/app/api/[...path]/route.js`) running the Firebase Admin SDK, so the whole app deploys free on Vercel (no Firebase Blaze plan needed).

## Run locally (Windows, VS Code)
1. Install **Node.js 20+** (nodejs.org). Open the extracted `hcm-lite` folder in VS Code → Terminal → New Terminal.
2. `npm install`
3. Firebase console → create project → **Authentication** → enable *Email/Password* → **Firestore Database** → create (production mode).
4. Project settings → *Your apps* → add **Web app** → copy config into `.env.local` (copy `.env.example` → `.env.local`).
5. Project settings → *Service accounts* → **Generate new private key** → copy `project_id`, `client_email`, `private_key` into `.env.local`. Never commit this.
6. Get a Gemini key at aistudio.google.com → `AI_API_KEY` in `.env.local` (optional; app works without AI and shows a friendly fallback).
7. Deploy the locked-down rules once: `npm i -g firebase-tools` → `firebase login` → `firebase use --add` → `firebase deploy --only firestore:rules`
8. `npm run dev` → open http://localhost:3000 → first-run setup creates the company + Admin.
9. Tests: `npm test` · production build: `npm run build`

## Deploy (live link for judges)
Push to GitHub → import in Vercel → add the same env variables in Vercel → Deploy. Add your Vercel domain in Firebase → Authentication → Settings → Authorized domains.

## Demo flow
Setup company → Settings: department, office hours/location, leave types, holidays → Users: create HR → (sign in as HR) register employees (temp password shown) → employee signs in, changes password, checks in → Leave → Smart leave "Need next Monday and Tuesday off for my sister's wedding" → confirm → HR approves → HR dashboard → Summarize, ask "who is on leave today?" → Payroll → calculate draft → Admin finalizes → employee downloads payslip PDF and asks for a colleague's salary (refused) → Admin → Audit log.

## Architecture
`src/lib/rules/*` pure business rules (attendance status, leave days/balance, payroll + tax, CSV validation, AI output validation, tool permissions) — unit-tested.
`src/lib/server/*` services: every request verifies the Firebase ID token, loads the user's **role and employeeId from Firestore** (never from the client), then checks role + data scope. `router.js` is the single table of endpoints and allowed roles.
AI: the browser calls `/api/ai/*` only; the server holds `AI_API_KEY`, offers only tools allowed for the caller's role, executes them with the caller's scope, 15 s timeout, 20 req/user/hour, logs every call to `ai_logs` (`aiLogs` collection), labels answers *AI-generated*, never writes data. Smart leave/summary JSON is validated and retried once, then falls back to the normal form.

### Firestore collections
`meta/setup` · `settings/company` · `departments` · `designations` · `leaveTypes/{code}` · `holidays/{YYYY-MM-DD}` · `users/{uid}` {role, employeeId, active, mustChangePassword} · `employees` · `employeeCodes/{code}` (uniqueness lock) · `attendance/{employeeId}_{date}` (one per day → 409) · `corrections` · `leaves` · `payrollRuns/{YYYY-MM}` · `payslips/{month}_{employeeId}` · `announcements` · `notifications` · `auditLogs` · `aiLogs` · `aiRate`.
Client access to Firestore is fully denied by `firestore.rules`.

## Decisions & assumptions
- **JWT/bcrypt:** Firebase Auth issues signed JWT ID tokens (verified server-side on every request) and stores passwords with salted scrypt, not bcrypt. Functionally equivalent; stated here openly.
- **Cloud Functions → Next.js API routes** so hosting is free (Functions require the Blaze plan).
- Tax: annual = monthly gross × 12 on the illustrative slabs, monthly tax = annual ÷ 12, prorated for joiners/leavers. Deductions use per-day = gross ÷ month working days. Days from today onward are not deducted.
- Leave balance counts approved + pending when applying; a leave cannot span two calendar years. Approved leave can be cancelled only before it starts.
- Absent = past working day with no record and no approved leave; today without a record is "pending" (excluded from rates).
- Leave utilization = approved days YTD ÷ (quota × headcount).

## Done / not done
Done: all 25 checklist functionalities, Roman Urdu replies (bonus).
Not done: camera/face attendance, attrition risk score, anomaly flags, 3-lates penalty, dark mode/PWA, mobile app. Automated end-to-end tests against Firebase were not run (unit + authorization tests only).
