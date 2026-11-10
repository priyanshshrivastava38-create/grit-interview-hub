import { prisma } from "@/lib/db";
import { buildSlotRange, dateKeyInTz, addDays } from "@/lib/time";
import type { EligibilityStatus } from "@/generated/prisma/enums";

export type TestWorld = {
  id: string;
  admin: { id: string; name: string };
  type: { id: string; code: string; retakeWaitDays: number; maxAttempts: number };
  badge: { id: string; code: string };
  interviewerUser: { id: string; name: string };
  interviewer: { id: string };
  availability: { id: string };
  slots: Array<{ id: string; startsAt: Date }>;
  studentIds: string[];
  userIds: string[];
  counter: number;
};

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Creates an isolated interviewer, interview type, badge and three future slots.
 * Every test uses its own suffix so suites can run in parallel against grit_test.
 */
export async function createWorld(prefix = "suite"): Promise<TestWorld> {
  const id = uniqueId(prefix);

  const admin = await prisma.user.create({
    data: { email: `admin-${id}@grit.test`, name: "Test Operations", role: "ADMIN" },
    select: { id: true, name: true },
  });

  const type = await prisma.interviewType.create({
    data: {
      code: `T-${id.toUpperCase()}`,
      name: "Test GRIT Interview",
      description: "Integration-test interview type.",
      durationMinutes: 45,
      passingScore: 70,
      retakeWaitDays: 14,
      maxAttempts: 3,
    },
  });

  const badge = await prisma.badge.create({
    data: {
      code: `B-${id.toUpperCase()}`,
      name: "Test Badge",
      description: "Integration-test badge.",
      level: "Foundation",
      validityMonths: 24,
      interviewTypeId: type.id,
    },
  });

  const interviewerUser = await prisma.user.create({
    data: { email: `interviewer-${id}@grit.test`, name: "Test Interviewer", role: "INTERVIEWER" },
    select: { id: true, name: true },
  });

  const interviewer = await prisma.interviewerProfile.create({
    data: {
      userId: interviewerUser.id,
      title: "Staff Engineer",
      specialty: "Platform",
      bio: "Integration-test interviewer.",
    },
    select: { id: true },
  });

  const day = dateKeyInTz(addDays(new Date(), 3));
  const availability = await prisma.interviewerAvailability.create({
    data: {
      interviewerId: interviewer.id,
      date: new Date(`${day}T00:00:00.000Z`),
      startTime: "09:00",
      endTime: "12:00",
      slotMinutes: 45,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const slotRows = buildSlotRange(day, "09:00", "12:00", 45).slice(0, 3);
  const slots: Array<{ id: string; startsAt: Date }> = [];
  for (const row of slotRows) {
    const slot = await prisma.interviewSlot.create({
      data: {
        availabilityId: availability.id,
        interviewerId: interviewer.id,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      },
      select: { id: true, startsAt: true },
    });
    slots.push(slot);
  }

  return {
    id,
    admin,
    type,
    badge,
    interviewerUser,
    interviewer,
    availability,
    slots,
    studentIds: [admin.id, interviewerUser.id],
    userIds: [admin.id, interviewerUser.id],
    counter: 0,
  };
}

export async function addStudent(
  world: TestWorld,
  options: { eligibility?: EligibilityStatus; name?: string } = {},
) {
  world.counter += 1;
  const suffix = `${world.id}-${world.counter}`;
  const eligibility = options.eligibility ?? "ELIGIBLE";
  const user = await prisma.user.create({
    data: {
      email: `student-${suffix}@grit.test`,
      name: options.name ?? `Test Student ${world.counter}`,
      role: "STUDENT",
    },
    select: { id: true, name: true },
  });
  const student = await prisma.studentProfile.create({
    data: {
      userId: user.id,
      studentCode: `SC-${suffix}`.toUpperCase(),
      program: "B.Tech Computer Science",
      cohort: "2026",
      university: "Test University",
      eligibilityStatus: eligibility,
      eligibleAt: eligibility === "NOT_ELIGIBLE" ? null : new Date(),
    },
  });
  world.studentIds.push(student.id);
  world.userIds.push(user.id);
  return { user, student };
}

export async function addSlot(world: TestWorld, startsAt: Date, minutes = 45) {
  return prisma.interviewSlot.create({
    data: {
      availabilityId: world.availability.id,
      interviewerId: world.interviewer.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    },
    select: { id: true, startsAt: true },
  });
}

export async function cleanupWorld(world: TestWorld): Promise<void> {
  const interviews = await prisma.interview.findMany({
    where: { studentId: { in: world.studentIds } },
    select: { id: true },
  });
  const bookings = await prisma.interviewBooking.findMany({
    where: { studentId: { in: world.studentIds } },
    select: { id: true },
  });
  const interviewIds = interviews.map((row) => row.id);
  const bookingIds = bookings.map((row) => row.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: world.userIds } },
        { entityId: { in: [...interviewIds, ...bookingIds, ...world.studentIds] } },
      ],
    },
  });
  await prisma.malpracticeCase.deleteMany({ where: { studentId: { in: world.studentIds } } });
  await prisma.retakeRequest.deleteMany({ where: { studentId: { in: world.studentIds } } });
  await prisma.badgeAward.deleteMany({ where: { studentId: { in: world.studentIds } } });
  await prisma.interview.deleteMany({ where: { id: { in: interviewIds } } });
  await prisma.interviewBooking.deleteMany({ where: { studentId: { in: world.studentIds } } });
  await prisma.interviewSlot.deleteMany({ where: { interviewerId: world.interviewer.id } });
  await prisma.interviewerAvailability.deleteMany({ where: { interviewerId: world.interviewer.id } });
  await prisma.studentProfile.deleteMany({ where: { id: { in: world.studentIds } } });
  await prisma.interviewerProfile.delete({ where: { id: world.interviewer.id } });
  await prisma.badge.delete({ where: { id: world.badge.id } });
  await prisma.interviewType.delete({ where: { id: world.type.id } });
  await prisma.user.deleteMany({ where: { id: { in: world.userIds } } });
}
