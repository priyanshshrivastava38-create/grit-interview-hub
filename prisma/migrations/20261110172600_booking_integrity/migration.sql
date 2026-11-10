-- Booking integrity is enforced by the database, not by application checks alone.

-- A student may hold at most one confirmed booking at a time. Historical rows
-- (CANCELLED, RESCHEDULED, NO_SHOW, COMPLETED) do not block a new booking.
CREATE UNIQUE INDEX "one_active_booking_per_student"
  ON "InterviewBooking" ("studentId")
  WHERE "status" = 'CONFIRMED';

-- A slot may be referenced by at most one confirmed booking. The booking
-- service locks and flips the slot inside one transaction; this constraint is
-- the final backstop if two transactions ever race past the lock.
CREATE UNIQUE INDEX "one_active_booking_per_slot"
  ON "InterviewBooking" ("slotId")
  WHERE "status" = 'CONFIRMED';

-- Domain-level guards.
ALTER TABLE "InterviewSlot"
  ADD CONSTRAINT "slot_time_order" CHECK ("endsAt" > "startsAt");

ALTER TABLE "InterviewerAvailability"
  ADD CONSTRAINT "availability_time_order" CHECK ("endTime" > "startTime"),
  ADD CONSTRAINT "availability_slot_minutes" CHECK ("slotMinutes" BETWEEN 15 AND 180);

ALTER TABLE "InterviewEvaluation"
  ADD CONSTRAINT "evaluation_technical_range" CHECK ("technicalScore" BETWEEN 0 AND 100),
  ADD CONSTRAINT "evaluation_problem_range" CHECK ("problemSolvingScore" BETWEEN 0 AND 100),
  ADD CONSTRAINT "evaluation_communication_range" CHECK ("communicationScore" BETWEEN 0 AND 100),
  ADD CONSTRAINT "evaluation_overall_range" CHECK ("overallScore" BETWEEN 0 AND 100);

ALTER TABLE "InterviewResult"
  ADD CONSTRAINT "result_score_range" CHECK ("overallScore" BETWEEN 0 AND 100);

-- Hot paths for queue and analytics queries.
CREATE INDEX IF NOT EXISTS "Interview_status_updated_idx" ON "Interview" ("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "InterviewBooking_status_bookedAt_idx" ON "InterviewBooking" ("status", "bookedAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");
