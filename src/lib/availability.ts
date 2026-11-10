import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "./audit";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { APP_TIMEZONE, buildSlotRange, dateKeyInTz, zonedDateTimeToUtc } from "./time";

export type AvailabilityInput = {
  interviewerId: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  breakStart?: string | null;
  breakEnd?: string | null;
  note?: string | null;
  actorUserId: string;
  now?: Date;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function validateWindow(input: {
  dateKey: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  breakStart?: string | null;
  breakEnd?: string | null;
  now: Date;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) throw new DomainError("VALIDATION", "Choose a valid date.");
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) {
    throw new DomainError("VALIDATION", "Start and end times must use HH:MM.");
  }
  if (toMinutes(input.endTime) <= toMinutes(input.startTime)) {
    throw new DomainError("VALIDATION", "End time must be after the start time.");
  }
  if (input.slotMinutes < 15 || input.slotMinutes > 180) {
    throw new DomainError("VALIDATION", "Interview length must be between 15 and 180 minutes.");
  }
  if (Boolean(input.breakStart) !== Boolean(input.breakEnd)) {
    throw new DomainError("VALIDATION", "Provide both a break start and break end, or neither.");
  }
  if (input.breakStart && input.breakEnd) {
    if (!TIME_RE.test(input.breakStart) || !TIME_RE.test(input.breakEnd)) {
      throw new DomainError("VALIDATION", "Break times must use HH:MM.");
    }
    const bStart = toMinutes(input.breakStart);
    const bEnd = toMinutes(input.breakEnd);
    if (bEnd <= bStart) throw new DomainError("VALIDATION", "Break end must be after the break start.");
    if (bStart < toMinutes(input.startTime) || bEnd > toMinutes(input.endTime)) {
      throw new DomainError("VALIDATION", "The break must sit inside the availability window.");
    }
  }
  if (input.dateKey < dateKeyInTz(input.now, APP_TIMEZONE)) {
    throw new DomainError("VALIDATION", "Availability cannot be added for a past date.");
  }
}

async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  interviewerId: string,
  dateKey: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const existing = await tx.interviewerAvailability.findMany({
    where: {
      interviewerId,
      date,
      status: "ACTIVE",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  for (const window of existing) {
    const otherStart = toMinutes(window.startTime);
    const otherEnd = toMinutes(window.endTime);
    if (start < otherEnd && end > otherStart) {
      throw new DomainError(
        "CONFLICT",
        `This overlaps an existing availability window on ${dateKey} (${window.startTime}–${window.endTime}). Edit or block that window first.`,
      );
    }
  }
}

function slotDataFor(input: AvailabilityInput, availabilityId: string, now: Date) {
  return buildSlotRange(
    input.dateKey,
    input.startTime,
    input.endTime,
    input.slotMinutes,
    input.breakStart,
    input.breakEnd,
    APP_TIMEZONE,
  )
    .filter((slot) => slot.startsAt.getTime() > now.getTime())
    .map((slot) => ({
      availabilityId,
      interviewerId: input.interviewerId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "OPEN" as const,
    }));
}

export async function createAvailability(input: AvailabilityInput) {
  const now = input.now ?? new Date();
  validateWindow({ ...input, now });

  return prisma.$transaction(async (tx) => {
    await assertNoOverlap(tx, input.interviewerId, input.dateKey, input.startTime, input.endTime);

    const availability = await tx.interviewerAvailability.create({
      data: {
        interviewerId: input.interviewerId,
        date: new Date(`${input.dateKey}T00:00:00.000Z`),
        startTime: input.startTime,
        endTime: input.endTime,
        slotMinutes: input.slotMinutes,
        breakStart: input.breakStart || null,
        breakEnd: input.breakEnd || null,
        note: input.note || null,
        status: "ACTIVE",
      },
    });

    const slots = slotDataFor(input, availability.id, now);
    if (slots.length === 0) {
      throw new DomainError("VALIDATION", "This window has no future slots. Widen the window or choose another date.");
    }
    await tx.interviewSlot.createMany({ data: slots, skipDuplicates: true });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "INTERVIEWER",
      action: "availability.created",
      entityType: "InterviewerAvailability",
      entityId: availability.id,
      summary: `Availability added for ${input.dateKey}, ${input.startTime}–${input.endTime} (${slots.length} slots).`,
      newValue: { ...input, slotCount: slots.length },
      createdAt: now,
    });

    return { availabilityId: availability.id, slotCount: slots.length };
  });
}

export async function updateAvailability(
  input: AvailabilityInput & { availabilityId: string },
) {
  const now = input.now ?? new Date();
  validateWindow({ ...input, now });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.interviewerAvailability.findUnique({
      where: { id: input.availabilityId },
      include: { slots: { include: { bookings: { where: { status: "CONFIRMED" } } } } },
    });
    if (!existing) throw new DomainError("NOT_FOUND", "Availability window not found.");
    if (existing.interviewerId !== input.interviewerId) {
      throw new DomainError("FORBIDDEN", "This availability belongs to another interviewer.");
    }
    const booked = existing.slots.filter((slot) => slot.bookings.length > 0 || slot.status === "BOOKED");
    if (booked.length > 0) {
      throw new DomainError(
        "CONFLICT",
        `This window contains ${booked.length} confirmed interview(s). Ask operations to reassign those interviews before editing the window.`,
      );
    }

    await assertNoOverlap(
      tx,
      input.interviewerId,
      input.dateKey,
      input.startTime,
      input.endTime,
      input.availabilityId,
    );

    await tx.interviewSlot.deleteMany({ where: { availabilityId: existing.id } });
    const availability = await tx.interviewerAvailability.update({
      where: { id: existing.id },
      data: {
        date: new Date(`${input.dateKey}T00:00:00.000Z`),
        startTime: input.startTime,
        endTime: input.endTime,
        slotMinutes: input.slotMinutes,
        breakStart: input.breakStart || null,
        breakEnd: input.breakEnd || null,
        note: input.note || null,
      },
    });
    const slots = slotDataFor(input, availability.id, now);
    if (slots.length === 0) {
      throw new DomainError("VALIDATION", "This window has no future slots. Widen the window or choose another date.");
    }
    await tx.interviewSlot.createMany({ data: slots, skipDuplicates: true });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "INTERVIEWER",
      action: "availability.updated",
      entityType: "InterviewerAvailability",
      entityId: availability.id,
      summary: `Availability updated for ${input.dateKey}, ${input.startTime}–${input.endTime}.`,
      previousValue: {
        date: existing.date.toISOString().slice(0, 10),
        startTime: existing.startTime,
        endTime: existing.endTime,
      },
      newValue: { ...input, slotCount: slots.length },
      createdAt: now,
    });

    return { availabilityId: availability.id, slotCount: slots.length };
  });
}

export async function setAvailabilityBlocked(input: {
  availabilityId: string;
  interviewerId: string;
  actorUserId: string;
  blocked: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const availability = await tx.interviewerAvailability.findUnique({
      where: { id: input.availabilityId },
      include: { slots: true },
    });
    if (!availability) throw new DomainError("NOT_FOUND", "Availability window not found.");
    if (availability.interviewerId !== input.interviewerId) {
      throw new DomainError("FORBIDDEN", "This availability belongs to another interviewer.");
    }

    if (input.blocked) {
      await tx.interviewerAvailability.update({
        where: { id: availability.id },
        data: { status: "BLOCKED" },
      });
      const cancelled = await tx.interviewSlot.updateMany({
        where: { availabilityId: availability.id, status: "OPEN", startsAt: { gt: now } },
        data: { status: "CANCELLED" },
      });
      const bookedCount = availability.slots.filter((slot) => slot.status === "BOOKED").length;

      await recordAudit(tx, {
        actorUserId: input.actorUserId,
        actorRole: "INTERVIEWER",
        action: "availability.blocked",
        entityType: "InterviewerAvailability",
        entityId: availability.id,
        summary: `Availability blocked; ${cancelled.count} open slot${cancelled.count === 1 ? "" : "s"} withdrawn${
          bookedCount > 0
            ? `; ${bookedCount} confirmed interview${bookedCount === 1 ? "" : "s"} now need${bookedCount === 1 ? "s" : ""} reassignment`
            : ""
        }.`,
        previousValue: { status: availability.status },
        newValue: { status: "BLOCKED", bookedCount },
        createdAt: now,
      });
      return { bookedCount, cancelledCount: cancelled.count };
    }

    await tx.interviewerAvailability.update({
      where: { id: availability.id },
      data: { status: "ACTIVE" },
    });

    const range = buildSlotRange(
      availability.date.toISOString().slice(0, 10),
      availability.startTime,
      availability.endTime,
      availability.slotMinutes,
      availability.breakStart,
      availability.breakEnd,
      APP_TIMEZONE,
    ).filter((slot) => slot.startsAt.getTime() > now.getTime());

    let reopened = 0;
    for (const slot of range) {
      const updated = await tx.interviewSlot.updateMany({
        where: {
          availabilityId: availability.id,
          startsAt: slot.startsAt,
          status: "CANCELLED",
          bookings: { none: { status: "CONFIRMED" } },
        },
        data: { status: "OPEN" },
      });
      reopened += updated.count;
      await tx.interviewSlot.createMany({
        data: [
          {
            availabilityId: availability.id,
            interviewerId: availability.interviewerId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            status: "OPEN",
          },
        ],
        skipDuplicates: true,
      });
    }

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "INTERVIEWER",
      action: "availability.unblocked",
      entityType: "InterviewerAvailability",
      entityId: availability.id,
      summary: `Availability reopened; ${reopened} slot(s) restored.`,
      newValue: { status: "ACTIVE" },
      createdAt: now,
    });

    return { bookedCount: 0, cancelledCount: 0 };
  });
}

export async function deleteAvailability(input: {
  availabilityId: string;
  interviewerId: string;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const availability = await tx.interviewerAvailability.findUnique({
      where: { id: input.availabilityId },
      include: { slots: { include: { bookings: { where: { status: "CONFIRMED" } } } } },
    });
    if (!availability) throw new DomainError("NOT_FOUND", "Availability window not found.");
    if (availability.interviewerId !== input.interviewerId) {
      throw new DomainError("FORBIDDEN", "This availability belongs to another interviewer.");
    }
    const booked = availability.slots.filter((slot) => slot.bookings.length > 0 || slot.status === "BOOKED");
    if (booked.length > 0) {
      throw new DomainError(
        "CONFLICT",
        `This window contains ${booked.length} confirmed interview(s) and cannot be deleted. Ask operations to reassign them first.`,
      );
    }

    await tx.interviewerAvailability.delete({ where: { id: availability.id } });
    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "INTERVIEWER",
      action: "availability.deleted",
      entityType: "InterviewerAvailability",
      entityId: availability.id,
      summary: `Availability window on ${availability.date.toISOString().slice(0, 10)} deleted.`,
      previousValue: {
        date: availability.date.toISOString().slice(0, 10),
        startTime: availability.startTime,
        endTime: availability.endTime,
      },
      createdAt: new Date(),
    });
  });
}

export function slotDateISO(date: Date): Date {
  return zonedDateTimeToUtc(date.toISOString().slice(0, 10), "00:00", APP_TIMEZONE);
}
