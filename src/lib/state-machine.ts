import type {
  BadgeStatus,
  BookingStatus,
  EligibilityStatus,
  InterviewStatus,
  MalpracticeStatus,
  RetakeStatus,
} from "@/generated/prisma/enums";
import { DomainError } from "./errors";

export const interviewTransitions: Record<InterviewStatus, InterviewStatus[]> = {
  SCHEDULED: ["IN_PROGRESS", "COMPLETED", "RESULT_PENDING"],
  IN_PROGRESS: ["COMPLETED", "RESULT_PENDING"],
  COMPLETED: ["RESULT_PENDING", "RESULT_PUBLISHED"],
  RESULT_PENDING: ["RESULT_PUBLISHED"],
  RESULT_PUBLISHED: [],
};

export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  CONFIRMED: ["CANCELLED", "RESCHEDULED", "COMPLETED", "NO_SHOW"],
  CANCELLED: [],
  RESCHEDULED: [],
  NO_SHOW: [],
  COMPLETED: [],
};

export const badgeTransitions: Record<BadgeStatus, BadgeStatus[]> = {
  NOT_EARNED: ["PENDING_CLEARANCE"],
  PENDING_CLEARANCE: ["AWARDED", "NULLIFIED"],
  AWARDED: ["SUSPENDED", "NULLIFIED"],
  SUSPENDED: ["AWARDED", "NULLIFIED"],
  NULLIFIED: [],
};

export const malpracticeTransitions: Record<MalpracticeStatus, MalpracticeStatus[]> = {
  REPORTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

export const retakeTransitions: Record<RetakeStatus, RetakeStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SCHEDULED", "COMPLETED"],
  REJECTED: [],
  SCHEDULED: ["COMPLETED"],
  COMPLETED: [],
};

export const eligibilityTransitions: Record<EligibilityStatus, EligibilityStatus[]> = {
  NOT_ELIGIBLE: ["ELIGIBLE"],
  ELIGIBLE: ["ELIGIBILITY_REVOKED"],
  ELIGIBILITY_REVOKED: ["ELIGIBLE"],
};

export function canTransition<T extends string>(map: Record<T, T[]>, from: T, to: T): boolean {
  return map[from]?.includes(to) ?? false;
}

export function assertTransition<T extends string>(
  map: Record<T, T[]>,
  from: T,
  to: T,
  label: string,
): void {
  if (!canTransition(map, from, to)) {
    throw new DomainError(
      "STATE",
      `${label} cannot move from ${humanize(from)} to ${humanize(to)}.`,
    );
  }
}

export function humanize(state: string): string {
  return state
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
