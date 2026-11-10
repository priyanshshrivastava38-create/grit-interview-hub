import type { PrismaClient } from "@/generated/prisma/client";
import { hoursUntil } from "./time";

type BookingEligibilityDb = Pick<
  PrismaClient,
  "studentProfile" | "interview" | "badgeAward" | "retakeRequest" | "interviewType" | "interviewBooking"
>;

export type BookingCheck =
  | {
      allowed: true;
      interviewTypeId: string;
      attemptNumber: number;
      retakeEligibleFrom: Date | null;
      approvedEarlyRetake: boolean;
    }
  | {
      allowed: false;
      code: "ELIGIBILITY" | "ACTIVE_BOOKING" | "BADGE" | "WAIT_PERIOD" | "ATTEMPTS" | "NOT_FOUND";
      message: string;
      retakeEligibleFrom?: Date | null;
    };

/** Pure business rules; the booking transaction calls this again after locking its rows. */
export async function getBookingEligibility(
  db: BookingEligibilityDb,
  studentId: string,
  interviewTypeId?: string,
  now = new Date(),
): Promise<BookingCheck> {
  const [student, type] = await Promise.all([
    db.studentProfile.findUnique({ where: { id: studentId } }),
    interviewTypeId
      ? db.interviewType.findUnique({ where: { id: interviewTypeId } })
      : db.interviewType.findFirst({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  if (!student) return { allowed: false, code: "NOT_FOUND", message: "Student profile not found." };
  if (!type) return { allowed: false, code: "NOT_FOUND", message: "No interview type is configured." };

  if (student.eligibilityStatus === "ELIGIBILITY_REVOKED") {
    return {
      allowed: false,
      code: "ELIGIBILITY",
      message:
        "Your interview eligibility has been revoked by interview operations. Please check your notifications or contact your program coordinator.",
    };
  }
  if (student.eligibilityStatus !== "ELIGIBLE") {
    return {
      allowed: false,
      code: "ELIGIBILITY",
      message:
        "You are not eligible to book yet. Complete the outstanding skill milestones shown on your dashboard and eligibility will unlock automatically.",
    };
  }

  const activeBooking = await db.interviewBooking.findFirst({
    where: { studentId, status: "CONFIRMED" },
    include: { interview: { include: { booking: { include: { slot: true } } } } },
  });
  if (activeBooking) {
    const when = activeBooking.interview?.booking.slot.startsAt;
    return {
      allowed: false,
      code: "ACTIVE_BOOKING",
      message: when
        ? `You already have a confirmed interview booking. Cancel or reschedule it from My Interviews before booking another.`
        : "You already have a confirmed interview booking.",
    };
  }

  const badge = await db.badgeAward.findFirst({
    where: { studentId, status: { in: ["AWARDED", "SUSPENDED"] } },
    include: { badge: true },
  });
  if (badge) {
    return {
      allowed: false,
      code: "BADGE",
      message:
        badge.status === "AWARDED"
          ? `You already hold the ${badge.badge.name} badge. No further interview is required.`
          : `Your ${badge.badge.name} badge is suspended pending an operations review. New bookings are paused.`,
    };
  }

  const attempts = await db.interview.count({ where: { studentId, interviewTypeId: type.id } });
  if (attempts >= type.maxAttempts) {
    return {
      allowed: false,
      code: "ATTEMPTS",
      message: `You have used all ${type.maxAttempts} interview attempts for ${type.name}. Contact interview operations to discuss your options.`,
    };
  }

  const lastResult = await db.interview.findFirst({
    where: {
      studentId,
      interviewTypeId: type.id,
      resultPublishedAt: { not: null },
      outcome: { in: ["FAIL", "RETAKE_LATER"] },
    },
    orderBy: { resultPublishedAt: "desc" },
  });

  let retakeEligibleFrom: Date | null = null;
  let approvedEarlyRetake = false;

  if (lastResult?.outcome === "FAIL" || lastResult?.outcome === "RETAKE_LATER") {
    retakeEligibleFrom = lastResult.retakeEligibleFrom;
    if (retakeEligibleFrom && now < retakeEligibleFrom) {
      const approved = await db.retakeRequest.findFirst({
        where: {
          studentId,
          interviewTypeId: type.id,
          status: "APPROVED",
          reviewedAt: lastResult.resultPublishedAt ? { gt: lastResult.resultPublishedAt } : undefined,
        },
        orderBy: { reviewedAt: "desc" },
      });
      approvedEarlyRetake = Boolean(approved);
      if (!approved) {
        const hours = Math.ceil(hoursUntil(retakeEligibleFrom, now));
        return {
          allowed: false,
          code: "WAIT_PERIOD",
          message: `Your retake window opens on ${retakeEligibleFrom.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          })} (about ${hours} hours from now). Submit a retake request if you need an earlier review.`,
          retakeEligibleFrom,
        };
      }
    }
  }

  return {
    allowed: true,
    interviewTypeId: type.id,
    attemptNumber: attempts + 1,
    retakeEligibleFrom,
    approvedEarlyRetake,
  };
}

export const BOOKING_POLICY = {
  minimumLeadMinutes: 60,
  cancellationHours: 4,
};
