import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { InterviewOutcome, SkillStatus } from "@/generated/prisma/enums";
import { STUDENT_MESSAGES } from "../notifications";
import {
  APP_TIMEZONE,
  addDays,
  buildSlotRange,
  dateKeyInTz,
  formatDateTime,
  zonedDateTimeToUtc,
} from "../time";

type Tx = Prisma.TransactionClient;

export async function seedDemoData(prisma: PrismaClient) {
  const now = new Date();
  const existing = await prisma.user.count();
  if (existing > 0) {
    throw new Error(
      "The database already contains demo data. Use the admin reset action or `npm run db:reset-demo` to restore the scenario set.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await seed(tx, now);
    },
    { timeout: 180_000, maxWait: 20_000 },
  );

  return { seededAt: now };
}

function timeAfter(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function seed(tx: Tx, now: Date) {
  const dayKey = (offset: number) => dateKeyInTz(addDays(now, offset), APP_TIMEZONE);
  const audit = async (input: {
    actorUserId?: string;
    actorRole?: "STUDENT" | "INTERVIEWER" | "ADMIN";
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    previousValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    createdAt: Date;
  }) => {
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        previousValue: input.previousValue,
        newValue: input.newValue,
        createdAt: input.createdAt,
      },
    });
  };

  await tx.skill.createMany({
    data: [
      {
        code: "FOUNDATIONS",
        name: "Product Thinking Foundations",
        description: "Frameworks for problem framing, user research and prioritisation.",
        sortOrder: 1,
      },
      {
        code: "DATA",
        name: "Data Modelling & SQL",
        description: "Relational modelling, querying and integrity constraints.",
        sortOrder: 2,
      },
      {
        code: "API",
        name: "API Design",
        description: "Contract design, validation, authorisation and failure handling.",
        sortOrder: 3,
      },
      {
        code: "SHIP",
        name: "Shipping & Debugging",
        description: "Production delivery, observability and incident debugging.",
        sortOrder: 4,
      },
      {
        code: "COMMS",
        name: "Written Communication",
        description: "Clear decision records and stakeholder updates.",
        sortOrder: 5,
      },
    ],
  });

  const skills = await tx.skill.findMany({ orderBy: { sortOrder: "asc" } });

  const [techType, systemsType] = await Promise.all([
    tx.interviewType.create({
      data: {
        code: "GRIT-TECH",
        name: "GRIT Technical Interview",
        description:
          "A structured 45-minute product engineering interview covering technical depth, problem solving and communication.",
        durationMinutes: 45,
        passingScore: 70,
        retakeWaitDays: 14,
        maxAttempts: 3,
      },
    }),
    tx.interviewType.create({
      data: {
        code: "GRIT-SYS",
        name: "GRIT Systems Deep Dive",
        description: "A 45-minute deep dive for candidates pursuing the advanced systems clearance.",
        durationMinutes: 45,
        passingScore: 75,
        retakeWaitDays: 21,
        maxAttempts: 2,
      },
    }),
  ]);

  await tx.badge.createMany({
    data: [
      {
        code: "GRIT-PE",
        name: "GRIT Certified Product Engineer",
        description:
          "Awarded after passing the GRIT Technical Interview; verifies product engineering judgement under realistic constraints.",
        level: "Core",
        validityMonths: 24,
        interviewTypeId: techType.id,
      },
      {
        code: "GRIT-SYS",
        name: "GRIT Systems Specialist",
        description: "Awarded after passing the GRIT Systems Deep Dive.",
        level: "Advanced",
        validityMonths: 24,
        interviewTypeId: systemsType.id,
      },
    ],
  });

  await tx.user.create({
    data: {
      email: "priyanka.raman@grit.demo",
      name: "Priyanka Raman",
      role: "ADMIN",
    },
  });
  const admin = await tx.user.findUniqueOrThrow({ where: { email: "priyanka.raman@grit.demo" } });

  const interviewerSeed = [
    {
      key: "vikram",
      name: "Vikram Sethi",
      email: "vikram.sethi@grit.demo",
      title: "Engineering Lead",
      specialty: "Distributed systems",
      bio: "15 years building payments and marketplace platforms. Interviews for depth of reasoning and production judgement.",
      maxDailyInterviews: 6,
    },
    {
      key: "neha",
      name: "Neha Kapoor",
      email: "neha.kapoor@grit.demo",
      title: "Staff Engineer",
      specialty: "Product engineering",
      bio: "Builds customer-facing products end to end. Focused on clarity of thought and pragmatic trade-offs.",
      maxDailyInterviews: 6,
    },
    {
      key: "aditya",
      name: "Aditya Menon",
      email: "aditya.menon@grit.demo",
      title: "Principal Engineer",
      specialty: "Platform & infrastructure",
      bio: "Platform leader with a bias for operability. Probes debugging instincts and systems ownership.",
      maxDailyInterviews: 4,
    },
    {
      key: "fatima",
      name: "Fatima Sheikh",
      email: "fatima.sheikh@grit.demo",
      title: "Engineering Manager",
      specialty: "Technical leadership",
      bio: "Engineering manager focused on communication, mentoring and delivery under ambiguity.",
      maxDailyInterviews: 6,
    },
  ];

  const interviewerByKey = new Map<string, { id: string; userId: string }>();
  for (const entry of interviewerSeed) {
    const user = await tx.user.create({
      data: {
        email: entry.email,
        name: entry.name,
        role: "INTERVIEWER",
        interviewer: {
          create: {
            title: entry.title,
            specialty: entry.specialty,
            bio: entry.bio,
            maxDailyInterviews: entry.maxDailyInterviews,
          },
        },
      },
      include: { interviewer: true },
    });
    interviewerByKey.set(entry.key, { id: user.interviewer!.id, userId: user.id });
  }

  type StudentSeed = {
    key: string;
    name: string;
    email: string;
    program?: string;
    cohort?: string;
    completedSkills: number;
    inProgressSkills?: number;
    eligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "ELIGIBILITY_REVOKED";
    eligibleDaysAgo: number | null;
    revokedReason?: string;
  };

  const studentSeed: StudentSeed[] = [
    { key: "aarav", name: "Aarav Mehta", email: "aarav.mehta@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 2 },
    { key: "ishita", name: "Ishita Rao", email: "ishita.rao@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 12 },
    { key: "kabir", name: "Kabir Shah", email: "kabir.shah@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 15 },
    { key: "meera", name: "Meera Krishnan", email: "meera.krishnan@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 20 },
    { key: "rohan", name: "Rohan Verma", email: "rohan.verma@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 18 },
    { key: "ananya", name: "Ananya Iyer", email: "ananya.iyer@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 9 },
    { key: "dev", name: "Dev Malhotra", email: "dev.malhotra@student.grit.demo", completedSkills: 2, inProgressSkills: 2, eligibility: "NOT_ELIGIBLE", eligibleDaysAgo: null },
    { key: "sara", name: "Sara Khan", email: "sara.khan@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 25 },
    { key: "nikhil", name: "Nikhil Joshi", email: "nikhil.joshi@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 14 },
    { key: "priya", name: "Priya Nair", email: "priya.nair@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 16 },
    { key: "arjun", name: "Arjun Desai", email: "arjun.desai@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 28 },
    { key: "tanya", name: "Tanya Bose", email: "tanya.bose@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 9 },
    { key: "aisha", name: "Aisha Siddiqui", email: "aisha.siddiqui@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBILITY_REVOKED", eligibleDaysAgo: 30, revokedReason: "Eligibility suspended while the program team verifies a placement record." },
    { key: "varun", name: "Varun Pillai", email: "varun.pillai@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 35 },
    { key: "riya", name: "Riya Sen", email: "riya.sen@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 11 },
    { key: "manav", name: "Manav Gupta", email: "manav.gupta@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 13 },
    { key: "sneha", name: "Sneha Pillai", email: "sneha.pillai@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 8 },
    { key: "neel", name: "Neel Bhatt", email: "neel.bhatt@student.grit.demo", completedSkills: 5, eligibility: "ELIGIBLE", eligibleDaysAgo: 17 },
  ];

  const studentByKey = new Map<
    string,
    { id: string; userId: string; name: string; email: string }
  >();

  let index = 1;
  for (const entry of studentSeed) {
    const eligibleAt = entry.eligibleDaysAgo === null ? null : addDays(now, -entry.eligibleDaysAgo);
    const user = await tx.user.create({
      data: {
        email: entry.email,
        name: entry.name,
        role: "STUDENT",
        student: {
          create: {
            studentCode: `GRIT-2026-${String(index).padStart(3, "0")}`,
            program: entry.program ?? "AI Product Engineering",
            cohort: entry.cohort ?? "Cohort 07",
            university: "GRIT Institute",
            eligibilityStatus: entry.eligibility,
            eligibilityReason:
              entry.eligibility === "ELIGIBLE"
                ? "All required skill milestones completed."
                : entry.eligibility === "ELIGIBILITY_REVOKED"
                  ? entry.revokedReason
                  : `${5 - entry.completedSkills} required skill milestone(s) still outstanding.`,
            eligibleAt,
            revokedAt: entry.eligibility === "ELIGIBILITY_REVOKED" ? addDays(now, -3) : null,
            skills: {
              create: skills.map((skill, skillIndex) => {
                const status: SkillStatus =
                  skillIndex < entry.completedSkills
                    ? "COMPLETED"
                    : skillIndex < entry.completedSkills + (entry.inProgressSkills ?? 0)
                      ? "IN_PROGRESS"
                      : "NOT_STARTED";
                return {
                  skillId: skill.id,
                  status,
                  score: status === "COMPLETED" ? 74 + ((skills.length * 7 + skillIndex * 3) % 23) : null,
                  completedAt: status === "COMPLETED" ? addDays(now, -(20 - skillIndex * 2)) : null,
                };
              }),
            },
          },
        },
      },
      include: { student: true },
    });
    studentByKey.set(entry.key, {
      id: user.student!.id,
      userId: user.id,
      name: user.name,
      email: user.email,
    });
    index += 1;
  }

  // ---------- Availability ----------

  type SlotRecord = { id: string; interviewerId: string; startsAt: Date; endsAt: Date; availabilityId: string };
  const slotIndex = new Map<string, SlotRecord>();

  const futureWindows: Array<{ interviewer: string; offset: number; start: string; end: string }> = [];
  for (const offset of [1, 2, 3, 4, 6, 8]) {
    for (const interviewer of ["vikram", "neha", "fatima"]) {
      futureWindows.push({ interviewer, offset, start: "09:00", end: "12:30" });
      futureWindows.push({ interviewer, offset, start: "14:00", end: "16:30" });
    }
  }
  futureWindows.push({ interviewer: "aditya", offset: 1, start: "09:00", end: "11:15" });
  futureWindows.push({ interviewer: "aditya", offset: 2, start: "10:00", end: "12:00" });

  const availabilityIds = new Map<string, string>();
  for (const window of futureWindows) {
    const interviewer = interviewerByKey.get(window.interviewer)!;
    const key = dayKey(window.offset);
    const availability = await tx.interviewerAvailability.create({
      data: {
        interviewerId: interviewer.id,
        date: new Date(`${key}T00:00:00.000Z`),
        startTime: window.start,
        endTime: window.end,
        slotMinutes: 45,
        status: "ACTIVE",
      },
    });
    availabilityIds.set(`${window.interviewer}|${window.offset}|${window.start}`, availability.id);
    const slots = buildSlotRange(key, window.start, window.end, 45, null, null, APP_TIMEZONE);
    for (const slot of slots) {
      const created = await tx.interviewSlot.create({
        data: {
          availabilityId: availability.id,
          interviewerId: interviewer.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: "OPEN",
        },
      });
      slotIndex.set(`${window.interviewer}|${slot.startsAt.toISOString()}`, {
        id: created.id,
        interviewerId: interviewer.id,
        startsAt: slot.startsAt,
        endsAt: created.endsAt,
        availabilityId: availability.id,
      });
    }
  }

  // A blocked day for Fatima demonstrates an interviewer withdrawing availability.
  const blockedAvailability = await tx.interviewerAvailability.create({
    data: {
      interviewerId: interviewerByKey.get("fatima")!.id,
      date: new Date(`${dayKey(5)}T00:00:00.000Z`),
      startTime: "09:00",
      endTime: "12:30",
      slotMinutes: 45,
      status: "BLOCKED",
      note: "Conference travel — unavailable.",
    },
  });

  const findSlot = (interviewer: string, offset: number, time: string) => {
    const startsAt = zonedDateTimeToUtc(dayKey(offset), time, APP_TIMEZONE);
    const slot = slotIndex.get(`${interviewer}|${startsAt.toISOString()}`);
    if (!slot) throw new Error(`Seed slot missing for ${interviewer} day ${offset} at ${time}`);
    return slot;
  };

  // ---------- Upcoming confirmed bookings ----------

  async function bookUpcoming(input: {
    studentKey: string;
    interviewer: string;
    offset: number;
    time: string;
    bookedDaysAgo: number;
    attempt?: number;
    notifyStudent?: boolean;
  }) {
    const student = studentByKey.get(input.studentKey)!;
    const slot = findSlot(input.interviewer, input.offset, input.time);
    const bookedAt = addDays(now, -input.bookedDaysAgo);
    await tx.interviewSlot.update({ where: { id: slot.id }, data: { status: "BOOKED" } });
    const booking = await tx.interviewBooking.create({
      data: {
        studentId: student.id,
        slotId: slot.id,
        status: "CONFIRMED",
        attemptNumber: input.attempt ?? 1,
        bookedAt,
      },
    });
    const interview = await tx.interview.create({
      data: {
        bookingId: booking.id,
        studentId: student.id,
        interviewerId: slot.interviewerId,
        interviewTypeId: techType.id,
        status: "SCHEDULED",
        attemptNumber: input.attempt ?? 1,
        createdAt: bookedAt,
      },
    });
    if (input.notifyStudent !== false) {
      await tx.notification.create({
        data: {
          userId: student.userId,
          type: "BOOKING_CONFIRMED",
          title: "Interview booked",
          body: STUDENT_MESSAGES.bookingConfirmed,
          link: "/student/interviews",
          createdAt: bookedAt,
        },
      });
    }
    await audit({
      actorUserId: student.userId,
      actorRole: "STUDENT",
      action: "booking.created",
      entityType: "InterviewBooking",
      entityId: booking.id,
      summary: `Interview booked for ${formatDateTime(slot.startsAt)}.`,
      newValue: {
        interviewerId: slot.interviewerId,
        startsAt: slot.startsAt.toISOString(),
      },
      createdAt: bookedAt,
    });
    return { booking, interview, slot };
  }

  await bookUpcoming({ studentKey: "ishita", interviewer: "neha", offset: 1, time: "10:30", bookedDaysAgo: 4 });
  await bookUpcoming({ studentKey: "riya", interviewer: "aditya", offset: 1, time: "09:00", bookedDaysAgo: 3, notifyStudent: false });
  await bookUpcoming({ studentKey: "manav", interviewer: "aditya", offset: 1, time: "09:45", bookedDaysAgo: 3, notifyStudent: false });
  await bookUpcoming({ studentKey: "sneha", interviewer: "aditya", offset: 1, time: "10:30", bookedDaysAgo: 2, notifyStudent: false });

  // Neha withdraws tomorrow's availability after Ishita's booking: operations must reassign.
  const nehaDayOne = availabilityIds.get("neha|1|09:00")!;
  await tx.interviewerAvailability.update({ where: { id: nehaDayOne }, data: { status: "BLOCKED" } });
  await tx.interviewSlot.updateMany({
    where: { availabilityId: nehaDayOne, status: "OPEN" },
    data: { status: "CANCELLED" },
  });
  await audit({
    actorUserId: interviewerByKey.get("neha")!.userId,
    actorRole: "INTERVIEWER",
    action: "availability.blocked",
    entityType: "InterviewerAvailability",
    entityId: nehaDayOne,
    summary: "Availability blocked after a personal commitment; one confirmed interview needs reassignment.",
    newValue: { status: "BLOCKED", bookedCount: 1 },
    createdAt: addDays(now, -1),
  });

  // Priya's reschedule: the historical booking stays, the old slot is released.
  const priya = studentByKey.get("priya")!;
  const priyaOldSlot = findSlot("fatima", 1, "14:45");
  const priyaOldBooking = await tx.interviewBooking.create({
    data: {
      studentId: priya.id,
      slotId: priyaOldSlot.id,
      status: "RESCHEDULED",
      attemptNumber: 1,
      bookedAt: addDays(now, -6),
      cancelledAt: addDays(now, -2),
      cancellationReason: "Student rescheduled",
    },
  });
  const priyaNew = await bookUpcoming({
    studentKey: "priya",
    interviewer: "fatima",
    offset: 2,
    time: "14:45",
    bookedDaysAgo: 2,
    notifyStudent: false,
  });
  await tx.interviewBooking.update({
    where: { id: priyaNew.booking.id },
    data: { rescheduledFromId: priyaOldBooking.id },
  });
  await tx.notification.create({
    data: {
      userId: priya.userId,
      type: "BOOKING_RESCHEDULED",
      title: "Interview rescheduled",
      body: `Your GRIT interview has been moved to ${formatDateTime(priyaNew.slot.startsAt)} with Fatima Sheikh. Your previous booking has been preserved in your interview history.`,
      link: "/student/interviews",
      createdAt: addDays(now, -2),
    },
  });
  await audit({
    actorUserId: priya.userId,
    actorRole: "STUDENT",
    action: "booking.rescheduled",
    entityType: "InterviewBooking",
    entityId: priyaNew.booking.id,
    summary: "Interview rescheduled to a later slot; original booking retained.",
    previousValue: { slotId: priyaOldSlot.id },
    newValue: { slotId: priyaNew.slot.id },
    createdAt: addDays(now, -2),
  });

  // Ananya cancelled and released her slot.
  const ananya = studentByKey.get("ananya")!;
  const ananyaSlot = findSlot("neha", 2, "11:15");
  const ananyaBooking = await tx.interviewBooking.create({
    data: {
      studentId: ananya.id,
      slotId: ananyaSlot.id,
      status: "CANCELLED",
      attemptNumber: 1,
      bookedAt: addDays(now, -5),
      cancelledAt: addDays(now, -2),
      cancellationReason: "Schedule conflict",
    },
  });
  await tx.notification.create({
    data: {
      userId: ananya.userId,
      type: "BOOKING_CANCELLED",
      title: "Interview cancelled",
      body: "Your interview has been cancelled and the slot released. You can book a new time whenever you are ready.",
      link: "/student/book",
      createdAt: addDays(now, -2),
    },
  });
  await audit({
    actorUserId: ananya.userId,
    actorRole: "STUDENT",
    action: "booking.cancelled",
    entityType: "InterviewBooking",
    entityId: ananyaBooking.id,
    summary: "Student cancelled and released the slot.",
    previousValue: { status: "CONFIRMED" },
    newValue: { status: "CANCELLED" },
    createdAt: addDays(now, -2),
  });

  // ---------- Historical interviews ----------

  async function createPastInterview(input: {
    studentKey: string;
    interviewer: string;
    daysAgo: number;
    time: string;
    status: "RESULT_PENDING" | "RESULT_PUBLISHED" | "COMPLETED";
    bookingStatus: "COMPLETED" | "NO_SHOW";
    outcome?: InterviewOutcome;
    evaluation?: {
      technical: number;
      problem: number;
      communication: number;
      recommendation: InterviewOutcome;
      strengths: string;
      improvements: string;
      notes: string;
    };
    publishedDaysAgo?: number;
    retakeDays?: number;
  }) {
    const student = studentByKey.get(input.studentKey)!;
    const interviewer = interviewerByKey.get(input.interviewer)!;
    const key = dayKey(-input.daysAgo);
    const startsAt = zonedDateTimeToUtc(key, input.time, APP_TIMEZONE);
    const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
    const availability = await tx.interviewerAvailability.create({
      data: {
        interviewerId: interviewer.id,
        date: new Date(`${key}T00:00:00.000Z`),
        startTime: input.time,
        endTime: timeAfter(input.time, 45),
        slotMinutes: 45,
        status: "ACTIVE",
        note: "Historical availability",
      },
    });
    const slot = await tx.interviewSlot.create({
      data: {
        availabilityId: availability.id,
        interviewerId: interviewer.id,
        startsAt,
        endsAt,
        status: "BOOKED",
      },
    });
    const booking = await tx.interviewBooking.create({
      data: {
        studentId: student.id,
        slotId: slot.id,
        status: input.bookingStatus,
        attemptNumber: 1,
        bookedAt: addDays(startsAt, -5),
      },
    });
    const completedAt = new Date(startsAt.getTime() + 50 * 60_000);
    const interview = await tx.interview.create({
      data: {
        bookingId: booking.id,
        studentId: student.id,
        interviewerId: interviewer.id,
        interviewTypeId: techType.id,
        status: input.status,
        outcome: input.outcome,
        attemptNumber: 1,
        startedAt: input.bookingStatus === "NO_SHOW" ? null : startsAt,
        completedAt: input.bookingStatus === "NO_SHOW" ? null : completedAt,
        resultPublishedAt: input.publishedDaysAgo ? addDays(now, -input.publishedDaysAgo) : null,
        retakeEligibleFrom:
          input.retakeDays !== undefined && input.publishedDaysAgo !== undefined
            ? addDays(now, input.retakeDays)
            : null,
        createdAt: addDays(startsAt, -5),
      },
    });

    if (input.evaluation) {
      const overall = Math.round(
        (input.evaluation.technical + input.evaluation.problem + input.evaluation.communication) / 3,
      );
      await tx.interviewEvaluation.create({
        data: {
          interviewId: interview.id,
          technicalScore: input.evaluation.technical,
          problemSolvingScore: input.evaluation.problem,
          communicationScore: input.evaluation.communication,
          overallScore: overall,
          strengths: input.evaluation.strengths,
          improvements: input.evaluation.improvements,
          notes: input.evaluation.notes,
          recommendation: input.evaluation.recommendation,
          submittedByUserId: interviewer.userId,
          submittedAt: completedAt,
        },
      });
    }

    if (input.outcome && input.publishedDaysAgo) {
      const publishedAt = addDays(now, -input.publishedDaysAgo);
      const overall = input.evaluation
        ? Math.round((input.evaluation.technical + input.evaluation.problem + input.evaluation.communication) / 3)
        : 70;
      await tx.interviewResult.create({
        data: {
          interviewId: interview.id,
          outcome: input.outcome,
          overallScore: overall,
          feedbackSummary:
            input.outcome === "PASS"
              ? "Strong structure, clear trade-off reasoning and production-aware answers. Cleared the bar for the badge."
              : input.outcome === "FAIL"
                ? "Core reasoning was present but several production concerns were missed. Review the feedback and prepare for another attempt."
                : "Some solid fundamentals, but the interview surfaced gaps that need more practice before another attempt.",
          publishedAt,
          publishedByUserId: admin.id,
        },
      });
      const body =
        input.outcome === "PASS"
          ? STUDENT_MESSAGES.resultPass
          : input.outcome === "FAIL"
            ? STUDENT_MESSAGES.resultFail
            : STUDENT_MESSAGES.resultRetake;
      await tx.notification.create({
        data: {
          userId: student.userId,
          type: "RESULT_PUBLISHED",
          title: input.outcome === "PASS" ? "You passed your GRIT interview" : "Interview result published",
          body,
          link: "/student/interviews",
          createdAt: publishedAt,
        },
      });
      await audit({
        actorUserId: admin.id,
        actorRole: "ADMIN",
        action: "result.published",
        entityType: "Interview",
        entityId: interview.id,
        summary: `Result published: ${input.outcome} (overall ${overall}).`,
        newValue: { outcome: input.outcome, overallScore: overall },
        createdAt: publishedAt,
      });
    }

    if (input.bookingStatus === "NO_SHOW") {
      await tx.notification.create({
        data: {
          userId: student.userId,
          type: "INTERVIEW_COMPLETED",
          title: "No-show recorded",
          body: `Interview operations recorded a no-show for your interview on ${formatDateTime(startsAt)}. Contact interview operations if this is incorrect.`,
          link: "/student/interviews",
          createdAt: addDays(now, -input.daysAgo),
        },
      });
      await audit({
        actorUserId: admin.id,
        actorRole: "ADMIN",
        action: "booking.no_show",
        entityType: "InterviewBooking",
        entityId: booking.id,
        summary: "Marked as no-show by operations.",
        newValue: { status: "NO_SHOW" },
        createdAt: addDays(now, -input.daysAgo),
      });
    }

    return { booking, interview, slot, startsAt };
  }

  const kabirScenario = await createPastInterview({
    studentKey: "kabir",
    interviewer: "vikram",
    daysAgo: 2,
    time: "15:30",
    status: "RESULT_PENDING",
    bookingStatus: "COMPLETED",
    evaluation: {
      technical: 72,
      problem: 68,
      communication: 75,
      recommendation: "PASS",
      strengths: "Structured problem decomposition and clear API contract reasoning.",
      improvements: "Needs to go deeper on failure modes and data integrity under concurrent writes.",
      notes: "Overall a confident interview. Recommend passing with development notes.",
    },
  });
  await tx.notification.create({
    data: {
      userId: studentByKey.get("kabir")!.userId,
      type: "INTERVIEW_COMPLETED",
      title: "Interview completed",
      body: "Your GRIT interview is complete. The evaluation has been submitted and your result is now awaiting publication by interview operations.",
      link: "/student/interviews",
      createdAt: addDays(now, -2),
    },
  });

  const meeraScenario = await createPastInterview({
    studentKey: "meera",
    interviewer: "neha",
    daysAgo: 5,
    time: "10:30",
    status: "RESULT_PUBLISHED",
    bookingStatus: "COMPLETED",
    outcome: "PASS",
    publishedDaysAgo: 4,
    evaluation: {
      technical: 82,
      problem: 78,
      communication: 86,
      recommendation: "PASS",
      strengths: "Excellent communication, strong product framing and a disciplined testing approach.",
      improvements: "Could articulate rollback strategy more crisply.",
      notes: "Cleared the bar comfortably. Badge approved.",
    },
  });

  const rohanScenario = await createPastInterview({
    studentKey: "rohan",
    interviewer: "fatima",
    daysAgo: 3,
    time: "14:45",
    status: "RESULT_PUBLISHED",
    bookingStatus: "COMPLETED",
    outcome: "FAIL",
    publishedDaysAgo: 3,
    retakeDays: 11,
    evaluation: {
      technical: 48,
      problem: 55,
      communication: 60,
      recommendation: "FAIL",
      strengths: "Good willingness to reason aloud and clarify requirements.",
      improvements: "Strengthen data modelling and practise tracing concurrency failures end to end.",
      notes: "Below the passing threshold. Retake recommended after the standard waiting period.",
    },
  });

  const saraScenario = await createPastInterview({
    studentKey: "sara",
    interviewer: "vikram",
    daysAgo: 8,
    time: "09:45",
    status: "RESULT_PUBLISHED",
    bookingStatus: "COMPLETED",
    outcome: "PASS",
    publishedDaysAgo: 7,
    evaluation: {
      technical: 88,
      problem: 84,
      communication: 90,
      recommendation: "PASS",
      strengths: "Exceptional systems intuition and precise communication.",
      improvements: "Minor: quantify trade-offs with latency estimates.",
      notes: "Strong pass.",
    },
  });

  const arjunScenario = await createPastInterview({
    studentKey: "arjun",
    interviewer: "neha",
    daysAgo: 12,
    time: "11:15",
    status: "RESULT_PUBLISHED",
    bookingStatus: "COMPLETED",
    outcome: "PASS",
    publishedDaysAgo: 11,
    evaluation: {
      technical: 85,
      problem: 80,
      communication: 88,
      recommendation: "PASS",
      strengths: "Clear structure, solid debugging instincts.",
      improvements: "Deeper treatment of idempotency would help.",
      notes: "Pass.",
    },
  });

  const nikhilScenario = await createPastInterview({
    studentKey: "nikhil",
    interviewer: "fatima",
    daysAgo: 6,
    time: "09:00",
    status: "COMPLETED",
    bookingStatus: "NO_SHOW",
  });

  const varunScenario = await createPastInterview({
    studentKey: "varun",
    interviewer: "vikram",
    daysAgo: 20,
    time: "10:30",
    status: "RESULT_PUBLISHED",
    bookingStatus: "COMPLETED",
    outcome: "FAIL",
    publishedDaysAgo: 19,
    retakeDays: -5,
    evaluation: {
      technical: 58,
      problem: 62,
      communication: 65,
      recommendation: "FAIL",
      strengths: "Good communication and honest about gaps.",
      improvements: "Build stronger SQL fundamentals and practise production debugging scenarios.",
      notes: "Just below the bar. Retake after the waiting period.",
    },
  });

  const neelScenario = await createPastInterview({
    studentKey: "neel",
    interviewer: "fatima",
    daysAgo: 4,
    time: "14:00",
    status: "RESULT_PUBLISHED",
    bookingStatus: "COMPLETED",
    outcome: "RETAKE_LATER",
    publishedDaysAgo: 3,
    retakeDays: 11,
    evaluation: {
      technical: 65,
      problem: 70,
      communication: 64,
      recommendation: "RETAKE_LATER",
      strengths: "Strong collaborative instincts and good requirements clarification.",
      improvements: "Needs more depth on system design and operational trade-offs.",
      notes: "Not ready yet; retake recommended after the waiting period.",
    },
  });

  // ---------- Badges ----------

  const coreBadge = await tx.badge.findFirstOrThrow({ where: { interviewTypeId: techType.id } });
  const meeraAward = await tx.badgeAward.create({
    data: {
      studentId: studentByKey.get("meera")!.id,
      badgeId: coreBadge.id,
      interviewId: meeraScenario.interview.id,
      status: "AWARDED",
      awardedAt: addDays(now, -4),
    },
  });
  const saraAward = await tx.badgeAward.create({
    data: {
      studentId: studentByKey.get("sara")!.id,
      badgeId: coreBadge.id,
      interviewId: saraScenario.interview.id,
      status: "AWARDED",
      awardedAt: addDays(now, -7),
    },
  });
  const arjunAward = await tx.badgeAward.create({
    data: {
      studentId: studentByKey.get("arjun")!.id,
      badgeId: coreBadge.id,
      interviewId: arjunScenario.interview.id,
      status: "NULLIFIED",
      awardedAt: addDays(now, -11),
      statusNote: "Nullified after a confirmed integrity case.",
    },
  });

  await tx.notification.createMany({
    data: [
      {
        userId: studentByKey.get("meera")!.userId,
        type: "BADGE_AWARDED",
        title: "Badge awarded",
        body: "Your GRIT Certified Product Engineer badge has been added to your dashboard.",
        link: "/student/badge",
        createdAt: addDays(now, -4),
      },
      {
        userId: studentByKey.get("sara")!.userId,
        type: "BADGE_AWARDED",
        title: "Badge awarded",
        body: "Your GRIT Certified Product Engineer badge has been added to your dashboard.",
        link: "/student/badge",
        createdAt: addDays(now, -7),
      },
      {
        userId: studentByKey.get("arjun")!.userId,
        type: "BADGE_AWARDED",
        title: "Badge status updated",
        body: "Your GRIT Certified Product Engineer badge has been nullified following an operations review. Your original interview result remains on record.",
        link: "/student/badge",
        createdAt: addDays(now, -9),
      },
    ],
  });

  // ---------- Retakes ----------

  await tx.retakeRequest.create({
    data: {
      studentId: studentByKey.get("rohan")!.id,
      interviewId: rohanScenario.interview.id,
      interviewTypeId: techType.id,
      reason:
        "I had a medical emergency the week of my interview and could not prepare properly. I would like an earlier review of my retake date.",
      status: "PENDING",
      eligibleFrom: addDays(now, 11),
      createdAt: addDays(now, -1),
    },
  });

  await tx.retakeRequest.create({
    data: {
      studentId: studentByKey.get("varun")!.id,
      interviewId: varunScenario.interview.id,
      interviewTypeId: techType.id,
      reason: "Requesting approval for my next attempt after completing the recommended preparation track.",
      status: "APPROVED",
      eligibleFrom: addDays(now, -5),
      reviewedByUserId: admin.id,
      reviewedAt: addDays(now, -2),
      decisionNote: "Approved. Preparation plan verified by program team.",
      createdAt: addDays(now, -3),
    },
  });
  await tx.notification.create({
    data: {
      userId: studentByKey.get("varun")!.userId,
      type: "RETAKE_UPDATED",
      title: "Retake approved",
      body: "Interview operations approved your retake. You can now book a new interview slot from your dashboard.",
      link: "/student/book",
      createdAt: addDays(now, -2),
    },
  });

  // ---------- Malpractice cases ----------

  const saraCase = await tx.malpracticeCase.create({
    data: {
      studentId: studentByKey.get("sara")!.id,
      interviewId: saraScenario.interview.id,
      reportedByUserId: admin.id,
      status: "UNDER_REVIEW",
      severity: "MEDIUM",
      allegation:
        "An automated proctoring signal flagged background conversation during the final ten minutes of the interview. The signal has not been verified.",
      evidence: "Proctoring session signal at interview_id " + saraScenario.interview.id,
      createdAt: addDays(now, -6),
    },
  });
  await audit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "malpractice.reported",
    entityType: "MalpracticeCase",
    entityId: saraCase.id,
    summary: "Proctoring signal reported for review.",
    newValue: { severity: "MEDIUM", status: "REPORTED" },
    createdAt: addDays(now, -6),
  });
  await audit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "malpractice.under_review",
    entityType: "MalpracticeCase",
    entityId: saraCase.id,
    summary: "Case moved to under review. Original result preserved.",
    previousValue: { status: "REPORTED" },
    newValue: { status: "UNDER_REVIEW" },
    createdAt: addDays(now, -5),
  });

  const arjunCase = await tx.malpracticeCase.create({
    data: {
      studentId: studentByKey.get("arjun")!.id,
      interviewId: arjunScenario.interview.id,
      reportedByUserId: admin.id,
      status: "CONFIRMED",
      severity: "HIGH",
      allegation:
        "Multiple verified signals showed an unauthorised third party answering technical questions on the candidate's behalf.",
      evidence: "Verified proctoring recording and identity mismatch at minute 18.",
      resolution:
        "Interview operations reviewed the recording with the interviewer and confirmed the integrity breach. Badge nullified; original result retained for audit.",
      badgeAction: "NULLIFY",
      confirmedByUserId: admin.id,
      confirmedAt: addDays(now, -9),
      createdAt: addDays(now, -11),
    },
  });
  await audit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "malpractice.confirmed",
    entityType: "MalpracticeCase",
    entityId: arjunCase.id,
    summary: "Integrity breach confirmed; badge nullified. Interview result preserved.",
    previousValue: { status: "UNDER_REVIEW" },
    newValue: { status: "CONFIRMED", badgeAction: "NULLIFY" },
    createdAt: addDays(now, -9),
  });

  // ---------- Notifications for the main demo personas ----------

  await tx.notification.createMany({
    data: [
      {
        userId: studentByKey.get("aarav")!.userId,
        type: "ELIGIBILITY_UNLOCKED",
        title: "Eligibility unlocked",
        body: STUDENT_MESSAGES.eligibilityUnlocked,
        link: "/student/book",
        createdAt: addDays(now, -2),
      },
      {
        userId: studentByKey.get("tanya")!.userId,
        type: "ELIGIBILITY_UNLOCKED",
        title: "Eligibility unlocked",
        body: STUDENT_MESSAGES.eligibilityUnlocked,
        link: "/student/book",
        createdAt: addDays(now, -9),
      },
      {
        userId: studentByKey.get("kabir")!.userId,
        type: "SYSTEM",
        title: "Result awaiting publication",
        body: "Your evaluation is complete and is queued for publication by interview operations. You will be notified as soon as it is published.",
        link: "/student/interviews",
        createdAt: addDays(now, -1),
        readAt: addDays(now, -1),
      },
      {
        userId: studentByKey.get("aisha")!.userId,
        type: "SYSTEM",
        title: "Eligibility updated",
        body: "Interview operations has placed your interview eligibility on hold while a placement record is verified.",
        link: "/student",
        createdAt: addDays(now, -3),
      },
      {
        userId: studentByKey.get("neel")!.userId,
        type: "RETAKE_UPDATED",
        title: "Retake window updated",
        body: STUDENT_MESSAGES.resultRetake,
        link: "/student/interviews",
        createdAt: addDays(now, -3),
      },
      {
        userId: admin.id,
        type: "SYSTEM",
        title: "Demo data loaded",
        body: "All GRIT demo scenarios have been seeded. Use the reset action to restore this state at any time.",
        link: "/admin",
        createdAt: now,
      },
    ],
  });

  // Mark older notifications as read to demonstrate read/unread states.
  await tx.notification.updateMany({
    where: { userId: studentByKey.get("meera")!.userId, createdAt: { lt: addDays(now, -1) } },
    data: { readAt: addDays(now, -3) },
  });

  // ---------- Audit highlights ----------

  await audit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "eligibility.unlocked",
    entityType: "StudentProfile",
    entityId: studentByKey.get("aarav")!.id,
    summary: "Eligibility unlocked after the final required skill milestone was completed.",
    previousValue: { eligibilityStatus: "NOT_ELIGIBLE" },
    newValue: { eligibilityStatus: "ELIGIBLE" },
    createdAt: addDays(now, -2),
  });
  await audit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "eligibility.revoked",
    entityType: "StudentProfile",
    entityId: studentByKey.get("aisha")!.id,
    summary: "Eligibility suspended while a placement record is verified.",
    previousValue: { eligibilityStatus: "ELIGIBLE" },
    newValue: { eligibilityStatus: "ELIGIBILITY_REVOKED" },
    createdAt: addDays(now, -3),
  });
  await audit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "badge.status_changed",
    entityType: "BadgeAward",
    entityId: arjunAward.id,
    summary: "Badge nullified after a confirmed malpractice case. Interview result preserved.",
    previousValue: { status: "AWARDED" },
    newValue: { status: "NULLIFIED" },
    createdAt: addDays(now, -9),
  });

  // Reference unused objects to keep the seed self-documenting and lint-clean.
  void blockedAvailability;
  void kabirScenario;
  void meeraAward;
  void saraAward;
  void nikhilScenario;
  void neelScenario;
  void systemsType;
  void dayKey;
}
