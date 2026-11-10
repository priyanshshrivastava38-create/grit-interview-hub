import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { bookSlot, cancelBooking, markNoShow, rescheduleBooking } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { addSlot, addStudent, cleanupWorld, createWorld, type TestWorld } from "./helpers/fixtures";

function expectDomainError(error: unknown, code: string): boolean {
  assert.ok(error instanceof DomainError, `expected DomainError, received ${String(error)}`);
  assert.equal((error as DomainError).code, code);
  return true;
}

describe("atomic booking", () => {
  let world: TestWorld;

  beforeEach(async () => {
    world = await createWorld("booking");
  });

  afterEach(async () => {
    await cleanupWorld(world);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("lets exactly one of two students win a contested slot", async () => {
    const first = await addStudent(world, { name: "Race Student A" });
    const second = await addStudent(world, { name: "Race Student B" });
    const slot = world.slots[0];
    const now = new Date();

    const results = await Promise.allSettled([
      bookSlot({ studentId: first.student.id, slotId: slot.id, actorUserId: first.user.id, now }),
      bookSlot({ studentId: second.student.id, slotId: slot.id, actorUserId: second.user.id, now }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(reason instanceof DomainError);
    assert.equal(reason.code, "CONFLICT");
    assert.match(reason.message, /no longer available/i);

    const bookings = await prisma.interviewBooking.findMany({ where: { slotId: slot.id } });
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].status, "CONFIRMED");

    const slotRow = await prisma.interviewSlot.findUniqueOrThrow({ where: { id: slot.id } });
    assert.equal(slotRow.status, "BOOKED");

    const interviews = await prisma.interview.count({ where: { bookingId: bookings[0].id } });
    assert.equal(interviews, 1);
    const notifications = await prisma.notification.count({
      where: { userId: { in: [first.user.id, second.user.id] }, type: "BOOKING_CONFIRMED" },
    });
    assert.equal(notifications, 1);
  });

  it("replays an idempotent booking instead of creating a second one", async () => {
    const { student, user } = await addStudent(world);
    const slot = world.slots[0];
    const key = `idem-${world.id}`;

    const first = await bookSlot({ studentId: student.id, slotId: slot.id, actorUserId: user.id, idempotencyKey: key });
    const replay = await bookSlot({ studentId: student.id, slotId: slot.id, actorUserId: user.id, idempotencyKey: key });

    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(first.bookingId, replay.bookingId);
    assert.equal(await prisma.interviewBooking.count({ where: { idempotencyKey: key } }), 1);
  });

  it("refuses a second confirmed booking for the same student", async () => {
    const { student, user } = await addStudent(world);
    await bookSlot({ studentId: student.id, slotId: world.slots[0].id, actorUserId: user.id });

    await assert.rejects(
      bookSlot({ studentId: student.id, slotId: world.slots[1].id, actorUserId: user.id }),
      (error) => expectDomainError(error, "CONFLICT"),
    );
  });

  it("enforces the 60 minute minimum lead time", async () => {
    const { student, user } = await addStudent(world);
    const slot = await addSlot(world, new Date(Date.now() + 30 * 60_000));

    await assert.rejects(
      bookSlot({ studentId: student.id, slotId: slot.id, actorUserId: user.id }),
      (error) => {
        expectDomainError(error, "POLICY");
        assert.match((error as DomainError).message, /60 minutes/i);
        return true;
      },
    );
  });

  it("blocks students whose eligibility is revoked", async () => {
    const { student, user } = await addStudent(world, { eligibility: "ELIGIBILITY_REVOKED" });

    await assert.rejects(
      bookSlot({ studentId: student.id, slotId: world.slots[0].id, actorUserId: user.id }),
      (error) => expectDomainError(error, "FORBIDDEN"),
    );
    assert.equal(await prisma.interviewBooking.count({ where: { studentId: student.id } }), 0);
  });

  it("enforces the student cancellation window but lets operations cancel", async () => {
    const { student, user } = await addStudent(world);
    const slot = await addSlot(world, new Date(Date.now() + 2 * 3_600_000));
    const booking = await bookSlot({ studentId: student.id, slotId: slot.id, actorUserId: user.id });

    await assert.rejects(
      cancelBooking({
        bookingId: booking.bookingId,
        actorUserId: user.id,
        actorRole: "STUDENT",
        studentId: student.id,
      }),
      (error) => expectDomainError(error, "POLICY"),
    );

    const result = await cancelBooking({
      bookingId: booking.bookingId,
      actorUserId: world.admin.id,
      actorRole: "ADMIN",
      reason: "Operations closed the session",
    });
    assert.equal(result.releasedSlot, true);

    const cancelled = await prisma.interviewBooking.findUniqueOrThrow({ where: { id: booking.bookingId } });
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(await prisma.interview.count({ where: { bookingId: booking.bookingId } }), 0);
    const released = await prisma.interviewSlot.findUniqueOrThrow({ where: { id: slot.id } });
    assert.equal(released.status, "OPEN");
    assert.equal(
      await prisma.notification.count({ where: { userId: user.id, type: "BOOKING_CANCELLED" } }),
      1,
    );
  });

  it("prevents students from cancelling another student's booking", async () => {
    const owner = await addStudent(world);
    const other = await addStudent(world);
    const booking = await bookSlot({
      studentId: owner.student.id,
      slotId: world.slots[0].id,
      actorUserId: owner.user.id,
    });

    await assert.rejects(
      cancelBooking({
        bookingId: booking.bookingId,
        actorUserId: other.user.id,
        actorRole: "STUDENT",
        studentId: other.student.id,
      }),
      (error) => expectDomainError(error, "FORBIDDEN"),
    );
  });

  it("reschedules by preserving the old booking and creating a linked one", async () => {
    const { student, user } = await addStudent(world);
    const original = await bookSlot({
      studentId: student.id,
      slotId: world.slots[0].id,
      actorUserId: user.id,
    });

    const moved = await rescheduleBooking({
      bookingId: original.bookingId,
      newSlotId: world.slots[1].id,
      actorUserId: user.id,
      actorRole: "STUDENT",
      studentId: student.id,
      reason: "Schedule conflict",
    });

    const oldBooking = await prisma.interviewBooking.findUniqueOrThrow({ where: { id: original.bookingId } });
    const newBooking = await prisma.interviewBooking.findUniqueOrThrow({ where: { id: moved.bookingId } });
    assert.equal(oldBooking.status, "RESCHEDULED");
    assert.equal(newBooking.status, "CONFIRMED");
    assert.equal(newBooking.rescheduledFromId, original.bookingId);
    assert.equal(newBooking.attemptNumber, oldBooking.attemptNumber);

    const oldSlot = await prisma.interviewSlot.findUniqueOrThrow({ where: { id: world.slots[0].id } });
    const newSlot = await prisma.interviewSlot.findUniqueOrThrow({ where: { id: world.slots[1].id } });
    assert.equal(oldSlot.status, "OPEN");
    assert.equal(newSlot.status, "BOOKED");
    assert.equal(await prisma.interview.count({ where: { bookingId: original.bookingId } }), 0);
    assert.equal(await prisma.interview.count({ where: { bookingId: moved.bookingId } }), 1);
    assert.equal(
      await prisma.notification.count({ where: { userId: user.id, type: "BOOKING_RESCHEDULED" } }),
      1,
    );
  });

  it("records a no-show without releasing the slot", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookSlot({
      studentId: student.id,
      slotId: world.slots[0].id,
      actorUserId: user.id,
    });

    await markNoShow({ bookingId: booking.bookingId, actorUserId: world.admin.id });

    const updated = await prisma.interviewBooking.findUniqueOrThrow({ where: { id: booking.bookingId } });
    assert.equal(updated.status, "NO_SHOW");
    const interview = await prisma.interview.findUniqueOrThrow({ where: { id: booking.interviewId } });
    assert.equal(interview.status, "COMPLETED");
    const slot = await prisma.interviewSlot.findUniqueOrThrow({ where: { id: world.slots[0].id } });
    assert.equal(slot.status, "BOOKED");
    assert.equal(
      await prisma.notification.count({ where: { userId: user.id, type: "INTERVIEW_COMPLETED" } }),
      1,
    );
  });
});
