# GRIT — Interview Hub

A working web application for the AI Product Engineer hiring assignment: interview scheduling, structured evaluation, badge clearance, retakes, integrity review, notifications, audit history and operational analytics for **students**, **interviewers** and **interview operations (admin)**.

The application is a real Next.js + PostgreSQL system. Bookings, state changes, evaluations, publications, badges and notifications are written to the database, guarded by server-side role checks and database constraints. It is not a static mockup and it does not store application state in `localStorage`.

- **Production build:** verified locally (`next build`, `next start`)
- **Automated tests:** 44 passing, including two students racing for the same slot
- **Live deployment:** not yet published — see [Deployment](#deployment). No public URL is claimed before it exists.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, custom design tokens, Lucide icons |
| Database | PostgreSQL |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Charts | Recharts |
| Validation | Zod on every server action |
| Tests | `node:test` + `tsx`, against a real PostgreSQL test database |

## Interface

The app is built as an enterprise workspace rather than a set of forms:

- **Role-based colour system**: each workspace has its own accent pair — teal/indigo for students, indigo/sky for interviewers, rose/amber for operations — applied through CSS custom properties on the app shell, so buttons, active navigation, progress and ambient backgrounds all recolour with the role.
- **Motion with restraint**: staggered card entrances, a page-level fade-up, animated clearance connectors and gradient sheen on primary actions. Every animation is disabled automatically under `prefers-reduced-motion`.
- **App shell** with role-aware navigation, workspace breadcrumb, page title and a timezone chip.
- **⌘K command palette** that searches every page the current role can reach, with arrow-key navigation.
- **Notification popover** in the header with unread count, relative timestamps and a link to full history.
- **Account menu** with identity, product overview, demo-role switching and sign out.
- **Clearance-path tracker** on the student dashboard: six stages (skills → eligibility → booking → interview → result → badge) with done, current, attention and upcoming states. On mobile the six stages become a complete two-column grid instead of a scrolled strip.
- **Mobile bottom navigation** with the role's four primary destinations, an active marker and a More button for the full drawer.
- **Progressive demo login**: one recommended persona per role up front, with the full scenario list behind a disclosure and search.
- Plain-language booking, reschedule and policy copy; native dialogs for confirmations, toast feedback and keyboard-accessible controls throughout.

## Demo access

The login screen lists seeded personas and signs in with a signed, http-only session cookie. Use the three quick actions (**Continue as Student / Interviewer / Interview operations**) or search the scenario list.

| Role | Persona | State you land in |
| --- | --- | --- |
| Student | Aarav Mehta | Eligible, not booked |
| Student | Tanya Bose | Eligible for 9 days, unbooked |
| Student | Kabir Shah | Result awaiting publication |
| Student | Meera Krishnan | Passed, badge awarded |
| Student | Rohan Verma | Failed, retake pending |
| Student | Sara Khan | Badge awarded, case under review |
| Student | Varun Pillai | Retake approved, ready to book |
| Student | Aisha Siddiqui | Eligibility revoked |
| Student | Dev Malhotra | Not eligible, 2 of 5 skills |
| Interviewer | Vikram Sethi | Open slots and evaluation history |
| Interviewer | Aditya Menon | Fully booked tomorrow |
| Interviewer | Fatima Sheikh | Blocked window with existing bookings |
| Admin | Priyanka Raman | Full operations access |

Every student journey has before/after states, so the same account can move through booking → evaluation → publication → badge (or retake/integrity paths) during a review.

## What each role can do

**Student**
- See eligibility, required skills and exactly what is blocking the next step.
- Browse real availability and book a slot through a confirmation dialog.
- Cancel (4-hour window) or reschedule; previous bookings stay in history.
- Read published results and the exact assignment notification copy.
- Track badge status and the retake waiting period; request a retake when eligible.

**Interviewer**
- Today’s overview, full schedule and evaluation history.
- Open, block or note availability windows; slot generation respects breaks.
- Start a session and submit a structured evaluation (three scores, strengths, improvements, notes, recommendation).
- Only the assigned interviewer can read or act on an interview — enforced on the server, not just hidden in the UI.

**Interview operations (admin)**
- Command centre with operational queues: overdue publications, reassignment needs, retakes, integrity cases.
- Student, booking, interviewer and result management, including reassignment and no-show recording.
- Publication of results, badge award/suspension/nullification.
- Retake decisions, malpractice investigation/confirmation, analytics and the immutable audit trail.
- Reset the demo to its original scenarios (demo mode only).

## Lifecycle and invariants

```
Eligibility:  NOT_ELIGIBLE ──▶ ELIGIBLE ──▶ ELIGIBILITY_REVOKED ──▶ ELIGIBLE
Booking:      CONFIRMED ──▶ CANCELLED / RESCHEDULED / COMPLETED / NO_SHOW
Interview:    SCHEDULED ──▶ IN_PROGRESS ──▶ COMPLETED ──▶ RESULT_PENDING ──▶ RESULT_PUBLISHED
Result:       PASS → badge awarded     FAIL / RETAKE_LATER → retake eligibility window
Badge:        PENDING_CLEARANCE ──▶ AWARDED ──▶ SUSPENDED ──▶ NULLIFIED
Malpractice:  REPORTED ──▶ UNDER_REVIEW ──▶ CONFIRMED ──▶ CLOSED
```

- Every transition is checked by a central state machine (`src/lib/state-machine.ts`) and by conditional database updates.
- Published results are terminal. Evaluations cannot be edited after submission. Cancelling or rescheduling never rewrites or deletes history.
- Business rules: 45-minute slots in `Asia/Kolkata`, 60 minutes minimum lead time, 4-hour cancellation window, one confirmed booking per student, 14/21-day retake waits, 3/2 maximum attempts per interview type (enforced in `src/lib/booking-eligibility.ts`).

### Booking under contention

Two students can click the same slot at the same moment. The booking transaction (`src/lib/booking.ts`) handles that with defense in depth:

1. `SELECT … FOR UPDATE` locks the student profile and the slot row.
2. Re-checks eligibility, slot status, lead time and existing active booking **inside** the transaction.
3. `updateMany({ where: { id, status: "OPEN" } })` — the winner must affect exactly one row.
4. Partial unique indexes enforce the same rules at the schema level:
   - one `CONFIRMED` booking per student,
   - one `CONFIRMED` booking per slot.
5. An idempotency key makes retries replay the original booking instead of creating a second one.

`tests/booking.integration.test.ts` fires both requests with `Promise.allSettled` and asserts that **exactly one** succeeds and the loser receives a conflict message.

## Notifications

Notifications are written inside the same database transaction as the state change they describe. Student copy for the three required events is fixed and verified by tests:

- **Eligibility unlocked** — “Congratulations! You have completed the required skill milestones and are now eligible for your GRIT interview. …”
- **Booking confirmed** — “Your GRIT interview has been successfully booked. …”
- **Result published** — separate exact copy for `PASS`, `FAIL` and `RETAKE_LATER`.

Publishing a pass also awards the badge; publishing a fail/retake creates the retake eligibility window. All three notify the student with a deep link.

## Security and access control

- Sessions are HMAC-signed, `httpOnly`, `SameSite=Lax`, `Secure` in production, 7-day expiry.
- Every page and server action calls `requireUser` / `requireRole` / `requireStudent` / `requireInterviewer` on the server. Hiding a button is never the control.
- Interviewers can only access interviews assigned to them; students can only change their own bookings.
- All server-action input is validated with Zod; domain errors are returned as typed results and shown as toasts.
- Audit records capture actor, action, entity, before/after values and timestamps. They are displayed in the admin audit trail.

**Honest limitation:** demo sign-in is persona-based, not password authentication. It is gated by `DEMO_MODE`, and `DEMO_MODE=false` disables demo login and demo reset. A production deployment would replace it with a real identity provider.

## Local setup

Requirements: Node.js 20.9+ and PostgreSQL 14+.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env
#    Set DATABASE_URL and AUTH_SECRET. Keep DEMO_MODE=true for the demo.

# 3. Create the schema and seed the scenarios
npm run db:migrate        # prisma migrate dev
npm run db:seed

# 4. Run
npm run dev               # http://localhost:3000
```

Production check:

```bash
npm run build
npm start
```

### Tests

Tests run against a separate PostgreSQL database and apply migrations automatically:

```bash
createdb grit_test
npm test
```

44 tests cover the state machines, timezone conversion, slot generation, idempotent/concurrent booking, cancellation and rescheduling policy, RBAC on evaluation, publication, badge award, retakes, malpractice and exact notification copy.

### Reset demo data

Use **Reset demo** in the admin sidebar (confirmation dialog, demo mode only) or:

```bash
npm run db:reset-demo
```

This truncates the application tables and rebuilds the original scenarios. It is destructive by design and is why it is restricted to demo mode and admins.

## Deployment

The application is deployment-ready but **has not been published yet**; this repository does not claim a live URL.

Target: Vercel (Next.js) + hosted PostgreSQL (Supabase or Neon).

1. Create a Postgres database and copy its pooled connection string.
2. Apply migrations and seed once against it:
   ```bash
   DATABASE_URL="postgresql://…" npm run db:deploy
   DATABASE_URL="postgresql://…" npm run db:seed
   ```
3. Import the repository into Vercel and set:
   - `DATABASE_URL` — hosted Postgres connection string
   - `AUTH_SECRET` — long random string
   - `APP_TIMEZONE=Asia/Kolkata`
   - `DEMO_MODE=true` (to enable the demo personas and reset action)
4. Deploy. Verify all three roles and a booking on the public URL before sharing it.

For Supabase, use the transaction pooler connection string (port `6543`) and append `?pgbouncer=true&connection_limit=1` for serverless usage.

## Project structure

```
prisma/
  schema.prisma          database model and enums
  migrations/            initial schema + booking integrity indexes
  seed.ts                demo scenarios
src/app/
  (app)/                 authenticated student / interviewer / admin routes
  actions/               server actions grouped by role
  login/                 demo persona picker
src/lib/
  booking.ts             atomic booking, cancel, reschedule, no-show
  booking-eligibility.ts pure booking rules and policy constants
  state-machine.ts       central transition tables
  results.ts             evaluation publication, badge award, notifications
  availability.ts        slot generation and blocking
  retakes.ts             retake review and scheduling
  malpractice.ts         integrity workflow
  analytics.ts           dashboard queries and chart series
  auth.ts                session and RBAC guards
src/components/          app shell, UI primitives, charts, dialogs
tests/                   unit and PostgreSQL integration tests
```

## Known limitations

- Demo authentication only; no SSO, passwords or email delivery. Notifications are in-app.
- Scheduling is single-timezone (`Asia/Kolkata`) by design for the assignment; the display layer is timezone-aware per user, but slot creation assumes IST wall-clock time.
- Email/SMS reminders are modelled as notification types but are not sent by an external provider.
- No file uploads; malpractice evidence is stored as text entered by operations.
