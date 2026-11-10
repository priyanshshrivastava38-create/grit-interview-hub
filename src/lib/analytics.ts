import { getBookingEligibility } from "./booking-eligibility";
import { prisma } from "./db";
import { addDays, dateKeyInTz, formatDate, hoursUntil } from "./time";
import { pct } from "./utils";

export type AdminMetrics = Awaited<ReturnType<typeof getAdminMetrics>>;

export async function getAdminMetrics(rangeDays = 30) {
  const now = new Date();
  const since = addDays(now, -rangeDays);

  const [
    totalStudents,
    eligibleStudents,
    eligibleUnbooked,
    confirmedBookings,
    completedInterviews,
    pendingResults,
    published,
    noShowCount,
    completedBookings,
    bookingRows,
    interviewRows,
    interviewerRows,
    upcomingSlots,
    retakePending,
    malpracticeOpen,
    retakeRequests,
    malpracticeCases,
    recentAudit,
    upcomingInterviews,
    eligibleUnbookedList,
    reassignments,
    cancellationRows,
  ] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.studentProfile.count({ where: { eligibilityStatus: "ELIGIBLE" } }),
    prisma.studentProfile.count({
      where: { eligibilityStatus: "ELIGIBLE", bookings: { none: { status: "CONFIRMED" } } },
    }),
    prisma.interviewBooking.count({ where: { status: "CONFIRMED" } }),
    prisma.interview.count({
      where: {
        status: { in: ["COMPLETED", "RESULT_PENDING", "RESULT_PUBLISHED"] },
        completedAt: { gte: since },
      },
    }),
    prisma.interview.count({ where: { status: "RESULT_PENDING" } }),
    prisma.interview.findMany({
      where: { status: "RESULT_PUBLISHED", resultPublishedAt: { gte: since } },
      select: { outcome: true, resultPublishedAt: true, completedAt: true, id: true },
    }),
    prisma.interviewBooking.count({ where: { status: "NO_SHOW", bookedAt: { gte: since } } }),
    prisma.interviewBooking.count({ where: { status: "COMPLETED", bookedAt: { gte: since } } }),
    prisma.interviewBooking.findMany({
      where: { bookedAt: { gte: since } },
      select: { bookedAt: true },
    }),
    prisma.interview.findMany({
      where: { booking: { slot: { startsAt: { gte: since, lte: addDays(now, 21) } } } },
      select: {
        outcome: true,
        status: true,
        completedAt: true,
        resultPublishedAt: true,
        interviewerId: true,
        student: { select: { eligibleAt: true } },
        booking: { select: { slot: { select: { startsAt: true } } } },
      },
    }),
    prisma.interviewerProfile.findMany({
      include: {
        user: { select: { name: true } },
        slots: {
          where: { startsAt: { gte: now, lte: addDays(now, 14) } },
          select: { status: true },
        },
        interviews: {
          where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "RESULT_PENDING"] } },
          select: { status: true },
        },
      },
    }),
    prisma.interviewSlot.findMany({
      where: { startsAt: { gte: now, lte: addDays(now, 14) }, status: { in: ["OPEN", "BOOKED"] } },
      select: { status: true },
    }),
    prisma.retakeRequest.count({ where: { status: "PENDING" } }),
    prisma.malpracticeCase.count({ where: { status: { in: ["REPORTED", "UNDER_REVIEW"] } } }),
    prisma.retakeRequest.findMany({
      where: { status: "PENDING" },
      include: {
        student: { include: { user: true } },
        interviewType: true,
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.malpracticeCase.findMany({
      where: { status: { in: ["REPORTED", "UNDER_REVIEW"] } },
      include: {
        student: { include: { user: true } },
        interview: { include: { result: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.interview.findMany({
      where: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        booking: { slot: { startsAt: { gte: now } } },
      },
      include: {
        student: { include: { user: true } },
        interviewer: { include: { user: true } },
        interviewType: true,
        booking: { include: { slot: true } },
      },
      orderBy: { booking: { slot: { startsAt: "asc" } } },
      take: 6,
    }),
    prisma.studentProfile.findMany({
      where: { eligibilityStatus: "ELIGIBLE", bookings: { none: { status: "CONFIRMED" } } },
      include: { user: true },
      orderBy: { eligibleAt: "asc" },
      take: 6,
    }),
    prisma.interview.findMany({
      where: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        booking: { slot: { startsAt: { gte: now } } },
        OR: [
          { interviewer: { isActive: false } },
          { booking: { slot: { availability: { status: "BLOCKED" } } } },
        ],
      },
      include: {
        student: { include: { user: true } },
        interviewer: { include: { user: true } },
        booking: { include: { slot: { include: { availability: true } } } },
      },
      orderBy: { booking: { slot: { startsAt: "asc" } } },
      take: 6,
    }),
    prisma.interviewBooking.findMany({
      where: { status: "CANCELLED", bookedAt: { gte: addDays(now, -30) } },
      select: { studentId: true },
    }),
  ]);

  const publishedCount = published.length;
  const passCount = published.filter((row) => row.outcome === "PASS").length;
  const retakeCount = published.filter((row) => row.outcome && row.outcome !== "PASS").length;

  const completedBookingsInRange = completedBookings + noShowCount;
  const noShowRate = completedBookingsInRange === 0 ? 0 : Math.round((noShowCount / completedBookingsInRange) * 100);
  const passRate = publishedCount === 0 ? null : Math.round((passCount / publishedCount) * 100);
  const retakeRate = publishedCount === 0 ? null : Math.round((retakeCount / publishedCount) * 100);

  const leadTimes = interviewRows
    .filter((row) => row.student.eligibleAt && row.booking.slot.startsAt)
    .map((row) => (row.booking.slot.startsAt.getTime() - row.student.eligibleAt!.getTime()) / 86_400_000)
    .filter((value) => value >= 0);
  const avgTimeToInterviewDays =
    leadTimes.length === 0 ? null : Math.round((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length) * 10) / 10;

  const publishLagHours = published
    .filter((row) => row.completedAt && row.resultPublishedAt)
    .map((row) => (row.resultPublishedAt!.getTime() - row.completedAt!.getTime()) / 3_600_000);
  const avgResultPublishHours =
    publishLagHours.length === 0
      ? null
      : Math.round((publishLagHours.reduce((sum, value) => sum + value, 0) / publishLagHours.length) * 10) / 10;

  const bookedSlots = upcomingSlots.filter((slot) => slot.status === "BOOKED").length;
  const interviewerUtilization =
    upcomingSlots.length === 0 ? null : Math.round((bookedSlots / upcomingSlots.length) * 100);

  const cancelCounts = new Map<string, number>();
  for (const row of cancellationRows) {
    cancelCounts.set(row.studentId, (cancelCounts.get(row.studentId) ?? 0) + 1);
  }
  const repeatedCancellers = Array.from(cancelCounts.values()).filter((count) => count > 1).length;

  const funnelEligible = eligibleStudents;
  const bookedStudentCount = (
    await prisma.studentProfile.findMany({
      where: { bookings: { some: {} } },
      select: { id: true },
    })
  ).length;
  const eligibilityConversion = funnelEligible === 0 ? null : Math.round((bookedStudentCount / funnelEligible) * 100);

  const dailyMap = new Map<string, { date: string; label: string; bookings: number }>();
  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const date = addDays(now, -offset);
    const key = dateKeyInTz(date);
    dailyMap.set(key, { date: key, label: formatDate(date).slice(0, 6), bookings: 0 });
  }
  for (const booking of bookingRows) {
    const entry = dailyMap.get(dateKeyInTz(booking.bookedAt));
    if (entry) entry.bookings += 1;
  }

  const outcomes = [
    { name: "Pass", key: "PASS", value: published.filter((row) => row.outcome === "PASS").length, color: "#0f766e" },
    { name: "Fail", key: "FAIL", value: published.filter((row) => row.outcome === "FAIL").length, color: "#b45309" },
    {
      name: "Retake later",
      key: "RETAKE_LATER",
      value: published.filter((row) => row.outcome === "RETAKE_LATER").length,
      color: "#64748b",
    },
  ];

  const workload = interviewerRows.map((interviewer) => {
    const upcoming = interviewer.interviews.filter((interview) => interview.status === "SCHEDULED").length;
    const inProgress = interviewer.interviews.filter((interview) => interview.status === "IN_PROGRESS").length;
    const pending = interviewer.interviews.filter((interview) => interview.status === "RESULT_PENDING").length;
    const total = interviewer.slots.length;
    const booked = interviewer.slots.filter((slot) => slot.status === "BOOKED").length;
    return {
      id: interviewer.id,
      name: interviewer.user.name,
      title: interviewer.title,
      upcoming,
      inProgress,
      pending,
      maxDailyInterviews: interviewer.maxDailyInterviews,
      utilization: total === 0 ? 0 : Math.round((booked / total) * 100),
    };
  });

  const overdueResults = interviewRows.filter(
    (row) => row.status === "RESULT_PENDING" && row.completedAt && hoursUntil(now, row.completedAt) > 24,
  ).length;

  const previousDaySlots = await prisma.interviewSlot.count({
    where: { startsAt: { gte: addDays(now, -7), lte: now }, status: "BOOKED" },
  });
  const previousWeekSlots = await prisma.interviewSlot.count({
    where: { startsAt: { gte: addDays(now, -7), lte: now } },
  });

  return {
    rangeDays,
    generatedAt: now,
    kpis: {
      totalStudents,
      eligibleStudents,
      eligibleUnbooked,
      confirmedBookings,
      completedInterviews,
      pendingResults,
      resultsAwaitingPublication: pendingResults,
      passRate,
      noShowRate,
      avgTimeToInterviewDays,
      avgResultPublishHours,
      interviewerUtilization,
      eligibilityConversion,
      retakeRate,
      overdueResults,
      pendingRetakes: retakePending,
      openMalpractice: malpracticeOpen,
      previousWeekUtilization: previousWeekSlots === 0 ? null : Math.round((previousDaySlots / previousWeekSlots) * 100),
    },
    charts: {
      bookings: Array.from(dailyMap.values()),
      outcomes,
      workload,
    },
    queue: {
      eligibleUnbooked: eligibleUnbookedList.map((student) => ({
        id: student.id,
        name: student.user.name,
        code: student.studentCode,
        eligibleAt: student.eligibleAt,
        daysWaiting: student.eligibleAt
          ? Math.max(0, Math.floor((now.getTime() - student.eligibleAt.getTime()) / 86_400_000))
          : 0,
      })),
      reassignments: reassignments.map((interview) => ({
        interviewId: interview.id,
        student: interview.student.user.name,
        interviewer: interview.interviewer.user.name,
        startsAt: interview.booking.slot.startsAt,
      })),
      retakes: retakeRequests.map((request) => ({
        id: request.id,
        student: request.student.user.name,
        type: request.interviewType.name,
        createdAt: request.createdAt,
        eligibleFrom: request.eligibleFrom,
        reason: request.reason,
      })),
      malpractice: malpracticeCases.map((item) => ({
        id: item.id,
        student: item.student.user.name,
        status: item.status,
        severity: item.severity,
        createdAt: item.createdAt,
      })),
    },
    upcomingInterviews: upcomingInterviews.map((interview) => ({
      id: interview.id,
      student: interview.student.user.name,
      interviewer: interview.interviewer.user.name,
      type: interview.interviewType.name,
      status: interview.status,
      startsAt: interview.booking.slot.startsAt,
    })),
    recentAudit,
    cancellationGroups: repeatedCancellers,
    totalCancellations30d: cancellationRows.length,
    funnel: {
      eligible: funnelEligible,
      booked: bookedStudentCount,
      completed: completedInterviews,
      passed: passCount,
      conversion: eligibilityConversion,
      utilization: interviewerUtilization,
      completionRate: completedInterviews === 0 ? null : pct(completedInterviews, Math.max(bookedStudentCount, 1)),
    },
  };
}

export type StudentDashboard = Awaited<ReturnType<typeof getStudentDashboard>>;

export async function getStudentDashboard(studentId: string) {
  const now = new Date();
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      user: true,
      skills: { include: { skill: true } },
      badgeAwards: {
        include: {
          badge: true,
          interview: { include: { result: true, interviewType: true, booking: { include: { slot: true } } } },
        },
      },
      retakes: { include: { interviewType: true }, orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  const [interviews, recentNotifications, unread, eligibility] = await Promise.all([
    prisma.interview.findMany({
      where: { studentId },
      include: {
        interviewType: true,
        interviewer: { include: { user: true } },
        booking: { include: { slot: true } },
        evaluation: true,
        result: true,
        badgeAward: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.findMany({
      where: { userId: profile.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notification.count({ where: { userId: profile.userId, readAt: null } }),
    getBookingEligibility(prisma, studentId, undefined, now),
  ]);

  const upcoming = interviews.filter((interview) =>
    ["SCHEDULED", "IN_PROGRESS"].includes(interview.status),
  );
  const history = interviews.filter((interview) =>
    ["COMPLETED", "RESULT_PENDING", "RESULT_PUBLISHED"].includes(interview.status),
  );
  const activeInterview = upcoming.find((interview) => interview.booking.status === "CONFIRMED") ?? null;
  const latestPublished = history.find((interview) => interview.status === "RESULT_PUBLISHED") ?? null;
  const badge = profile.badgeAwards[0] ?? null;

  return {
    profile,
    skills: profile.skills.sort((a, b) => a.skill.sortOrder - b.skill.sortOrder),
    eligibility,
    activeInterview,
    upcoming,
    history,
    latestPublished,
    badge,
    retakes: profile.retakes,
    notifications: recentNotifications,
    unreadNotifications: unread,
    now,
  };
}

export type InterviewerDashboard = Awaited<ReturnType<typeof getInterviewerDashboard>>;

export async function getInterviewerDashboard(interviewerId: string) {
  const now = new Date();
  const todayKey = dateKeyInTz(now);
  const [profile, interviews, slots] = await Promise.all([
    prisma.interviewerProfile.findUniqueOrThrow({
      where: { id: interviewerId },
      include: { user: true },
    }),
    prisma.interview.findMany({
      where: { interviewerId },
      include: {
        student: { include: { user: true, skills: { include: { skill: true } } } },
        interviewType: true,
        booking: { include: { slot: true } },
        evaluation: true,
        result: true,
      },
      orderBy: { booking: { slot: { startsAt: "asc" } } },
    }),
    prisma.interviewSlot.findMany({
      where: { interviewerId, startsAt: { gte: now } },
      include: { availability: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const todays = interviews.filter(
    (interview) => dateKeyInTz(interview.booking.slot.startsAt) === todayKey && interview.status !== "RESULT_PUBLISHED",
  );
  const upcoming = interviews.filter(
    (interview) =>
      interview.booking.slot.startsAt >= now &&
      ["SCHEDULED", "IN_PROGRESS"].includes(interview.status),
  );
  const needsEvaluation = interviews.filter(
    (interview) =>
      !interview.evaluation &&
      ["SCHEDULED", "IN_PROGRESS"].includes(interview.status) &&
      interview.booking.slot.startsAt <= now,
  );
  const completed = interviews.filter((interview) => interview.result);
  const awaitingPublication = interviews.filter(
    (interview) => interview.evaluation && interview.status === "RESULT_PENDING",
  );
  const upcomingOpen = slots.filter((slot) => slot.status === "OPEN").length;
  const upcomingBooked = slots.filter((slot) => slot.status === "BOOKED").length;
  const avgScore =
    completed.length === 0
      ? null
      : Math.round(completed.reduce((sum, interview) => sum + (interview.evaluation?.overallScore ?? 0), 0) / completed.length);

  return {
    profile,
    todays,
    upcoming: upcoming.slice(0, 8),
    needsEvaluation,
    awaitingPublication,
    completed,
    slots,
    stats: {
      upcomingCount: upcoming.length,
      openSlots: upcomingOpen,
      bookedSlots: upcomingBooked,
      completedCount: completed.length,
      pendingEvaluation: interviews.filter((interview) => interview.evaluation && interview.status === "RESULT_PENDING").length,
      avgScore,
      utilization: upcomingOpen + upcomingBooked === 0 ? 0 : Math.round((upcomingBooked / (upcomingOpen + upcomingBooked)) * 100),
    },
    now,
  };
}

export function scoreBand(value: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (value >= 75) return { label: "Strong", tone: "good" };
  if (value >= 60) return { label: "Developing", tone: "warn" };
  return { label: "Needs work", tone: "bad" };
}
