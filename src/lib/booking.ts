import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { recordAudit } from "./audit";
import { BOOKING_POLICY, getBookingEligibility } from "./booking-eligibility";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { STUDENT_MESSAGES, notify } from "./notifications";
import { assertTransition, bookingTransitions } from "./state-machine";
import { formatDateTime, hoursUntil } from "./time";

type LockedSlot = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  interviewerId: string;
};

async function lockSlot(tx: Prisma.TransactionClient, slotId: string): Promise<LockedSlot | null> {
  const rows = await tx.$queryRaw<LockedSlot[]>`
    SELECT id, status, "startsAt", "endsAt", "interviewerId"
    FROM "InterviewSlot"
    WHERE id = ${slotId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002");
}

export type BookSlotInput = {
  studentId: string;
  slotId: string;
  actorUserId: string;
  idempotencyKey?: string;
  interviewTypeId?: string;
  now?: Date;
};

export type BookSlotResult = { bookingId: string; interviewId: string; replayed: boolean };

/**
 * The critical path. Row locks on the student and slot plus the partial unique indexes
 * (one confirmed booking per student / per slot) guarantee a single winner under a race.
 */
export async function bookSlot(input: BookSlotInput): Promise<BookSlotResult> {
  const now = input.now ?? new Date();

  try {
    return await prisma.$transaction(
      async (tx) => {
        if (input.idempotencyKey) {
          const replay = await tx.interviewBooking.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: { interview: true },
          });
          if (replay) {
            if (replay.studentId !== input.studentId) {
              throw new DomainError("CONFLICT", "This booking request has already been used.");
            }
            if (!replay.interview) throw new DomainError("CONFLICT", "Booking is missing its interview record.");
            return { bookingId: replay.id, interviewId: replay.interview.id, replayed: true };
          }
        }

        const profileRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "StudentProfile" WHERE id = ${input.studentId} FOR UPDATE`;
        if (profileRows.length === 0) throw new DomainError("NOT_FOUND", "Student profile not found.");

        const check = await getBookingEligibility(tx, input.studentId, input.interviewTypeId, now);
        if (!check.allowed) {
          const code =
            check.code === "WAIT_PERIOD" || check.code === "ATTEMPTS"
              ? "POLICY"
              : check.code === "ELIGIBILITY"
                ? "FORBIDDEN"
                : check.code === "NOT_FOUND"
                  ? "NOT_FOUND"
                  : "CONFLICT";
          throw new DomainError(code, check.message);
        }

        const slot = await lockSlot(tx, input.slotId);
        if (!slot) throw new DomainError("NOT_FOUND", "That interview slot no longer exists.");

        if (slot.status !== "OPEN") {
          throw new DomainError(
            "CONFLICT",
            "That slot was just taken by another student. The seat is no longer available — please choose a different time.",
          );
        }
        if (slot.startsAt.getTime() <= now.getTime()) {
          throw new DomainError("CONFLICT", "That slot has already started. Please choose a future slot.");
        }
        if (hoursUntil(slot.startsAt, now) * 60 < BOOKING_POLICY.minimumLeadMinutes) {
          throw new DomainError(
            "POLICY",
            `Interviews require at least ${BOOKING_POLICY.minimumLeadMinutes} minutes of preparation time. Please pick a later slot.`,
          );
        }

        const active = await tx.interviewBooking.findFirst({
          where: { studentId: input.studentId, status: "CONFIRMED" },
          select: { id: true },
        });
        if (active) {
          throw new DomainError(
            "CONFLICT",
            "You already have a confirmed interview booking. Cancel or reschedule it before booking another.",
          );
        }

        const reserved = await tx.interviewSlot.updateMany({
          where: { id: slot.id, status: "OPEN" },
          data: { status: "BOOKED" },
        });
        if (reserved.count !== 1) {
          throw new DomainError(
            "CONFLICT",
            "That slot was just taken by another student. The seat is no longer available — please choose a different time.",
          );
        }

        const interviewType = await tx.interviewType.findUniqueOrThrow({
          where: { id: check.interviewTypeId },
        });

        const booking = await tx.interviewBooking.create({
          data: {
            studentId: input.studentId,
            slotId: slot.id,
            status: "CONFIRMED",
            attemptNumber: check.attemptNumber,
            idempotencyKey: input.idempotencyKey,
            bookedAt: now,
          },
        });

        const interview = await tx.interview.create({
          data: {
            bookingId: booking.id,
            studentId: input.studentId,
            interviewerId: slot.interviewerId,
            interviewTypeId: interviewType.id,
            status: "SCHEDULED",
            attemptNumber: check.attemptNumber,
            createdAt: now,
          },
        });

        await tx.retakeRequest.updateMany({
          where: {
            studentId: input.studentId,
            interviewTypeId: interviewType.id,
            status: "APPROVED",
          },
          data: { status: "SCHEDULED" },
        });

        const student = await tx.studentProfile.findUniqueOrThrow({
          where: { id: input.studentId },
          select: { userId: true },
        });

        await notify(tx, {
          userId: student.userId,
          type: "BOOKING_CONFIRMED",
          title: "Interview booked",
          body: STUDENT_MESSAGES.bookingConfirmed,
          link: "/student/interviews",
          createdAt: now,
        });

        await recordAudit(tx, {
          actorUserId: input.actorUserId,
          actorRole: "STUDENT",
          action: "booking.created",
          entityType: "InterviewBooking",
          entityId: booking.id,
          summary: `Interview booked for ${formatDateTime(slot.startsAt)}.`,
          newValue: {
            slotId: slot.id,
            interviewerId: slot.interviewerId,
            startsAt: slot.startsAt.toISOString(),
            attemptNumber: check.attemptNumber,
          },
          createdAt: now,
        });

        return { bookingId: booking.id, interviewId: interview.id, replayed: false };
      },
      { timeout: 15_000, isolationLevel: "ReadCommitted" },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message =
        (error as { meta?: { target?: string[] } }).meta?.target?.includes("studentId")
          ? "You already have a confirmed interview booking."
          : "That slot was just taken by another student. The seat is no longer available — please choose a different time.";
      throw new DomainError("CONFLICT", message);
    }
    throw error;
  }
}

export type CancelBookingInput = {
  bookingId: string;
  actorUserId: string;
  actorRole: Role;
  studentId?: string;
  reason?: string;
  now?: Date;
};

export async function cancelBooking(input: CancelBookingInput): Promise<{ releasedSlot: boolean }> {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "InterviewBooking" WHERE id = ${input.bookingId} FOR UPDATE`;
    const booking = await tx.interviewBooking.findUnique({
      where: { id: input.bookingId },
      include: {
        slot: true,
        interview: { include: { evaluation: true, result: true } },
      },
    });
    if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");

    if (input.actorRole === "STUDENT" && booking.studentId !== input.studentId) {
      throw new DomainError("FORBIDDEN", "You can only change your own bookings.");
    }
    assertTransition(bookingTransitions, booking.status, "CANCELLED", "Booking");

    if (input.actorRole === "STUDENT") {
      if (booking.slot.startsAt.getTime() <= now.getTime()) {
        throw new DomainError("POLICY", "This interview has already started and can no longer be cancelled.");
      }
      if (hoursUntil(booking.slot.startsAt, now) < BOOKING_POLICY.cancellationHours) {
        throw new DomainError(
          "POLICY",
          `Cancellations must be made at least ${BOOKING_POLICY.cancellationHours} hours before the interview. Please contact interview operations if there is an emergency.`,
        );
      }
    }
    if (booking.interview?.evaluation || booking.interview?.result) {
      throw new DomainError(
        "STATE",
        "An evaluation has already been recorded for this interview, so the booking can no longer be cancelled.",
      );
    }

    await tx.interviewBooking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: input.reason ?? (input.actorRole === "STUDENT" ? "Cancelled by student" : "Cancelled by operations"),
      },
    });

    const releasedSlot = booking.slot.startsAt.getTime() > now.getTime();
    await tx.interviewSlot.update({
      where: { id: booking.slotId },
      data: { status: releasedSlot ? "OPEN" : "CANCELLED" },
    });

    if (booking.interview) {
      await tx.interview.delete({ where: { id: booking.interview.id } });
    }

    const student = await tx.studentProfile.findUniqueOrThrow({
      where: { id: booking.studentId },
      select: { userId: true },
    });

    await notify(tx, {
      userId: student.userId,
      type: "BOOKING_CANCELLED",
      title: "Interview cancelled",
      body:
        input.actorRole === "STUDENT"
          ? `Your interview on ${formatDateTime(booking.slot.startsAt)} has been cancelled. ${
              releasedSlot
                ? "The slot has been released. You can book a new time whenever you are ready."
                : "Please contact interview operations if this was unexpected."
            }`
          : `Interview operations cancelled your interview on ${formatDateTime(booking.slot.startsAt)}. Reason: ${
              input.reason ?? "No reason provided"
            }. You can book a new slot from your dashboard.`,
      link: "/student/book",
      createdAt: now,
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: "booking.cancelled",
      entityType: "InterviewBooking",
      entityId: booking.id,
      summary: `Booking cancelled. ${releasedSlot ? "Slot released." : "Slot not released."}`,
      previousValue: { status: booking.status, slotId: booking.slotId },
      newValue: { status: "CANCELLED", reason: input.reason ?? null },
      createdAt: now,
    });

    return { releasedSlot };
  });
}

export type RescheduleBookingInput = {
  bookingId: string;
  newSlotId: string;
  actorUserId: string;
  actorRole: Role;
  studentId?: string;
  reason?: string;
  now?: Date;
};

export async function rescheduleBooking(
  input: RescheduleBookingInput,
): Promise<{ bookingId: string; interviewId: string }> {
  const now = input.now ?? new Date();

  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "InterviewBooking" WHERE id = ${input.bookingId} FOR UPDATE`;
        const booking = await tx.interviewBooking.findUnique({
          where: { id: input.bookingId },
          include: { slot: true, interview: { include: { evaluation: true, result: true } } },
        });
        if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
        if (input.actorRole === "STUDENT" && booking.studentId !== (input.studentId ?? "")) {
          throw new DomainError("FORBIDDEN", "You can only reschedule your own bookings.");
        }
        if (booking.status !== "CONFIRMED") {
          throw new DomainError("STATE", "Only confirmed bookings can be rescheduled.");
        }
        if (booking.slot.startsAt.getTime() <= now.getTime()) {
          throw new DomainError("POLICY", "This interview has already started and cannot be rescheduled.");
        }
        if (input.actorRole === "STUDENT" && hoursUntil(booking.slot.startsAt, now) < BOOKING_POLICY.cancellationHours) {
          throw new DomainError(
            "POLICY",
            `Reschedules must be requested at least ${BOOKING_POLICY.cancellationHours} hours before the interview. Please contact interview operations for urgent changes.`,
          );
        }
        if (booking.interview?.evaluation || booking.interview?.result) {
          throw new DomainError("STATE", "This interview already has a recorded evaluation and cannot be moved.");
        }
        if (input.newSlotId === booking.slotId) {
          throw new DomainError("VALIDATION", "Choose a different slot to reschedule.");
        }

        const ids = [booking.slotId, input.newSlotId].sort();
        for (const id of ids) {
          const locked = await lockSlot(tx, id);
          if (!locked) throw new DomainError("NOT_FOUND", "The selected slot no longer exists.");
          if (id === input.newSlotId) {
            if (locked.status !== "OPEN") {
              throw new DomainError(
                "CONFLICT",
                "That slot was just taken. Please choose another time — your current booking is unchanged.",
              );
            }
            if (locked.startsAt.getTime() <= now.getTime()) {
              throw new DomainError("CONFLICT", "The selected slot has already started. Choose a future time.");
            }
          }
        }

        const newSlot = await tx.interviewSlot.findUniqueOrThrow({ where: { id: input.newSlotId } });

        const reserved = await tx.interviewSlot.updateMany({
          where: { id: newSlot.id, status: "OPEN" },
          data: { status: "BOOKED" },
        });
        if (reserved.count !== 1) {
          throw new DomainError(
            "CONFLICT",
            "That slot was just taken. Please choose another time — your current booking is unchanged.",
          );
        }

        await tx.interviewSlot.update({ where: { id: booking.slotId }, data: { status: "OPEN" } });
        await tx.interviewBooking.update({
          where: { id: booking.id },
          data: { status: "RESCHEDULED", cancelledAt: now, cancellationReason: input.reason ?? "Rescheduled" },
        });

        const newBooking = await tx.interviewBooking.create({
          data: {
            studentId: booking.studentId,
            slotId: newSlot.id,
            status: "CONFIRMED",
            attemptNumber: booking.attemptNumber,
            bookedAt: now,
            rescheduledFromId: booking.id,
          },
        });

        if (booking.interview) {
          await tx.interview.delete({ where: { id: booking.interview.id } });
        }

        const newInterview = await tx.interview.create({
          data: {
            bookingId: newBooking.id,
            studentId: booking.studentId,
            interviewerId: newSlot.interviewerId,
            interviewTypeId:
              booking.interview?.interviewTypeId ??
              (await tx.interviewType.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } })).id,
            status: "SCHEDULED",
            attemptNumber: booking.attemptNumber,
            createdAt: now,
          },
        });

        const student = await tx.studentProfile.findUniqueOrThrow({
          where: { id: booking.studentId },
          select: { userId: true },
        });
        const interviewer = await tx.interviewerProfile.findUnique({
          where: { id: newSlot.interviewerId },
          select: { user: { select: { name: true } } },
        });

        await notify(tx, {
          userId: student.userId,
          type: "BOOKING_RESCHEDULED",
          title: "Interview rescheduled",
          body: `Your GRIT interview has been moved to ${formatDateTime(newSlot.startsAt)} with ${
            interviewer?.user.name ?? "your interviewer"
          }. Your previous booking has been preserved in your interview history.`,
          link: "/student/interviews",
          createdAt: now,
        });

        await recordAudit(tx, {
          actorUserId: input.actorUserId,
          actorRole: input.actorRole,
          action: input.actorRole === "ADMIN" ? "booking.reassigned" : "booking.rescheduled",
          entityType: "InterviewBooking",
          entityId: newBooking.id,
          summary:
            input.actorRole === "ADMIN"
              ? `Interview reassigned from ${formatDateTime(booking.slot.startsAt)} to ${formatDateTime(newSlot.startsAt)}.`
              : `Interview rescheduled from ${formatDateTime(booking.slot.startsAt)} to ${formatDateTime(newSlot.startsAt)}.`,
          previousValue: { bookingId: booking.id, slotId: booking.slotId, startsAt: booking.slot.startsAt.toISOString() },
          newValue: { bookingId: newBooking.id, slotId: newSlot.id, startsAt: newSlot.startsAt.toISOString() },
          createdAt: now,
        });

        return { bookingId: newBooking.id, interviewId: newInterview.id };
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError(
        "CONFLICT",
        "That slot was just taken. Please choose another time — your current booking is unchanged.",
      );
    }
    throw error;
  }
}

export async function markNoShow(input: {
  bookingId: string;
  actorUserId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "InterviewBooking" WHERE id = ${input.bookingId} FOR UPDATE`;
    const booking = await tx.interviewBooking.findUnique({
      where: { id: input.bookingId },
      include: { slot: true, interview: true },
    });
    if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
    assertTransition(bookingTransitions, booking.status, "NO_SHOW", "Booking");
    if (!booking.interview) throw new DomainError("STATE", "Booking has no interview record.");

    await tx.interviewBooking.update({ where: { id: booking.id }, data: { status: "NO_SHOW" } });
    await tx.interview.update({
      where: { id: booking.interview.id },
      data: { status: "COMPLETED", completedAt: now, startedAt: booking.interview.startedAt ?? now },
    });

    const student = await tx.studentProfile.findUniqueOrThrow({
      where: { id: booking.studentId },
      select: { userId: true },
    });
    await notify(tx, {
      userId: student.userId,
      type: "INTERVIEW_COMPLETED",
      title: "No-show recorded",
      body: `Interview operations recorded a no-show for your interview on ${formatDateTime(
        booking.slot.startsAt,
      )}. Contact interview operations if this is incorrect.`,
      link: "/student/interviews",
      createdAt: now,
    });
    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "ADMIN",
      action: "booking.no_show",
      entityType: "InterviewBooking",
      entityId: booking.id,
      summary: "Marked as no-show by operations.",
      previousValue: { status: booking.status },
      newValue: { status: "NO_SHOW" },
      createdAt: now,
    });
  });
}
