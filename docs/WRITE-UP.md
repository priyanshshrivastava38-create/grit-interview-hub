# GRIT Interview Hub — product & technical write-up

## The problem

GRIT runs a practical clearance for AI Product Engineer candidates. The process looks simple from the outside — finish your skills, book an interview, get a result — but it is a coordination problem with real consequences. Slots are limited and contended, results and badges are contractual, retakes have waiting periods, integrity cases can revoke something already awarded, and every decision has to be explainable later. Most internal tools fail here in one of two ways: they let two people book the same slot, or they let a status change overwrite the record of what happened before.

I built Interview Hub as an opinionated, working system for the three people in that loop: the student, the interviewer, and interview operations.

## What the product does

**Students** see one clear next step instead of a wall of controls. The dashboard explains eligibility and which skill milestones are blocking it; the booking screen shows real availability and requires an explicit confirmation that includes the slot, the interviewer and the cancellation policy. After booking, the same page becomes a guidance card pointing to the interview they already hold. Results, badge status, retake windows and notification history are first-class screens, not emails the student has to reconstruct.

**Interviewers** get the day, the schedule, availability management and a structured evaluation form: three dimension scores, strengths, improvements, internal notes and a recommendation. The form warns when a session is still in the future, and submission closes the interview for editing. An interviewer can only open interviews assigned to them.

**Interview operations** work queues rather than tables: overdue publications, bookings that need reassignment after an availability block, retake requests, integrity cases. They publish results, award or suspend badges, reassign interviews, record no-shows, investigate malpractice and read an audit trail that records actor, action, before and after values. Analytics are computed from the database, not hard-coded.

## Architecture

The application is a single Next.js 16 App Router project with React Server Components and server actions. There is no separate API layer to drift out of sync: mutations are server actions that authenticate, validate with Zod, call a domain service, and return a typed result the client shows as a toast.

The domain is deliberately concentrated. `state-machine.ts` owns the legal transitions for interviews, bookings, badges, retakes, malpractice and eligibility. `booking.ts` owns the atomic booking, cancellation, rescheduling and no-show paths. `results.ts` owns publication, badge award and result notifications. Pages read through `analytics.ts` and focused query helpers. This keeps the rules testable without rendering React, and makes every screen a view over the same invariants.

PostgreSQL with Prisma 7 is the source of truth. The schema models people, availability, slots, bookings, interviews, evaluations, results, badge awards, retake requests, malpractice cases, notifications and audit logs. Money-like history is never mutated: rescheduling marks the old booking `RESCHEDULED` and links the new one to it; cancellations keep the booking row; published results are terminal.

## Correctness under contention

The brief calls out the case that matters: two students racing for one slot, exactly one wins. The booking transaction locks the student profile and the slot row with `SELECT … FOR UPDATE`, re-runs the eligibility and slot checks inside the lock, then reserves the slot with a conditional `updateMany` that must affect exactly one row. Two partial unique indexes — one confirmed booking per student, one per slot — enforce the same rules even if a future code path forgets the lock. A unique idempotency key makes a retried request return the original booking instead of duplicating it.

The integration test races two students with `Promise.allSettled` and asserts one success, one `CONFLICT`, one booking, and a slot that is `BOOKED` exactly once. Other tests cover the lead-time rule, cancellation windows, reschedule history, no-show behaviour, invalid scores, double publication, wait-period enforcement, malpractice nullification, revoked eligibility, and the exact assignment notification copy.

## Security and access control

Authentication is a signed, http-only session cookie; in the demo it is issued by the persona picker, and `DEMO_MODE=false` turns it off. Authorization is server-side on every page and every action — `requireRole`, `requireStudent` and `requireInterviewer`. Interviewers are checked against the interview's assigned interviewer, and students against booking ownership, inside the service rather than in the UI. All mutations are Zod-validated, and every consequential action writes an audit row in the same transaction as the change it describes.

## Design decisions

The visual language is quiet enterprise software: warm canvas, ink text, a single teal accent, dense but readable tables, and status pills that match the domain vocabulary. The usability work focused on decision points rather than decoration:

- **One next step.** Blocked booking states explain why and link to the screen that resolves them; a preview mode still lets a curious student see availability without implying they can book.
- **No accidental commitments.** Booking opens a confirmation dialog with slot details and policy before anything is written.
- **Honest error states.** A lost race produces a specific message ("that slot was just taken"), not a generic failure, and refreshes the availability.
- **Accessible controls.** Visible focus, skip link, labelled dialogs, Escape-to-close mobile navigation with scroll lock, 44px-class touch targets, and responsive layouts down to 390px.
- **Exact copy where it is contractual.** The three required student notifications are constants, reused by the notification service and asserted in tests.

## Trade-offs and next steps

Scheduling is intentionally single-timezone (`Asia/Kolkata`) with per-user display formats; multi-timezone availability would be the next domain change, not a UI change. Demo authentication is not production identity — it is isolated behind `DEMO_MODE` and would be replaced with SSO. Notifications are in-app only; the schema already separates type, title, body and deep link, so an email provider can be added behind the same service call.

The result is a system that demonstrates the hard parts of the assignment — concurrency, state, permissions, history and operational clarity — with a UI that a real student or interviewer could use without a walkthrough.
