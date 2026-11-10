import type { JourneyStep } from "@/components/journey";
import type { StudentDashboardData } from "@/lib/analytics";
import { formatDate, formatDateTime, tzAbbreviation } from "@/lib/time";

export function buildStudentJourney(data: StudentDashboardData): JourneyStep[] {
  const { profile, skills, activeInterview, latestPublished, badge } = data;
  const completedSkills = skills.filter((skill) => skill.status === "COMPLETED").length;
  const missingSkills = skills.filter((skill) => skill.skill.isRequired && skill.status !== "COMPLETED");
  const pendingResult = data.history.find((interview) => interview.status === "RESULT_PENDING");
  const publishedResult = latestPublished?.result;

  const skillsDone = missingSkills.length === 0;
  const revoked = profile.eligibilityStatus === "ELIGIBILITY_REVOKED";
  const isEligible = profile.eligibilityStatus === "ELIGIBLE";
  const hasBooked = Boolean(activeInterview) || data.history.length > 0;
  const resultPending = Boolean(pendingResult);
  const resultPublished = Boolean(publishedResult);
  const badgeState: JourneyStep["state"] = badge
    ? badge.status === "AWARDED"
      ? "done"
      : "attention"
    : publishedResult?.outcome === "PASS"
      ? "current"
      : "upcoming";

  return [
    {
      label: "Skills",
      detail: `${completedSkills}/${skills.length} complete`,
      state: skillsDone ? "done" : "current",
    },
    {
      label: "Eligibility",
      detail: revoked ? "On hold" : isEligible ? "Unlocked" : "Locked",
      state: revoked ? "attention" : isEligible ? "done" : skillsDone ? "current" : "upcoming",
    },
    {
      label: "Booking",
      detail: activeInterview
        ? formatDate(activeInterview.booking.slot.startsAt)
        : hasBooked
          ? "Booked previously"
          : "Choose a slot",
      state: hasBooked ? "done" : isEligible && skillsDone ? "current" : "upcoming",
    },
    {
      label: "Interview",
      detail: activeInterview
        ? formatDate(activeInterview.booking.slot.startsAt)
        : resultPending || resultPublished
          ? "Attended"
          : "Not scheduled",
      state: resultPending || resultPublished ? "done" : activeInterview ? "current" : "upcoming",
    },
    {
      label: "Result",
      detail: publishedResult
        ? publishedResult.outcome === "PASS"
          ? "Passed"
          : publishedResult.outcome === "FAIL"
            ? "Not passed"
            : "Retake later"
        : resultPending
          ? "Awaiting publication"
          : "Not published",
      state: publishedResult ? "done" : resultPending ? "current" : "upcoming",
    },
    {
      label: "Badge",
      detail: badge
        ? badge.status.replaceAll("_", " ").toLowerCase()
        : publishedResult?.outcome === "PASS"
          ? "Awarding soon"
          : "After a pass",
      state: badgeState,
    },
  ];
}

export type StudentNextAction = {
  eyebrow: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "bad" | "info" | "accent" | "neutral";
  cta: { href: string; label: string };
};

export function buildStudentNextAction(data: StudentDashboardData): StudentNextAction {
  const { profile, skills, eligibility, activeInterview, latestPublished, badge, retakes } = data;
  const missingSkills = skills.filter((skill) => skill.skill.isRequired && skill.status !== "COMPLETED");
  const publishedResult = latestPublished?.result;
  const pendingRetake = retakes.find((retake) => retake.status === "PENDING");
  const approvedRetake = retakes.find((retake) => retake.status === "APPROVED");
  const pendingResult = data.history.find((interview) => interview.status === "RESULT_PENDING");

  if (profile.eligibilityStatus === "ELIGIBILITY_REVOKED") {
    return {
      eyebrow: "Eligibility on hold",
      title: "Your eligibility is under review",
      body:
        profile.eligibilityReason ??
        "Interview operations has paused your eligibility. Check notifications or contact your program coordinator.",
      tone: "bad",
      cta: { href: "/notifications", label: "Read notification" },
    };
  }
  if (profile.eligibilityStatus === "NOT_ELIGIBLE") {
    return {
      eyebrow: "Complete your milestones",
      title: `Finish ${missingSkills.length} required skill${missingSkills.length === 1 ? "" : "s"} to unlock interviews`,
      body: "Eligibility unlocks automatically when your remaining milestones are marked complete. Your progress below shows exactly what is outstanding.",
      tone: "info",
      cta: { href: "#skills", label: "View requirements" },
    };
  }
  if (activeInterview) {
    if (activeInterview.status === "IN_PROGRESS") {
      return {
        eyebrow: "Interview in progress",
        title: "Your interview has started",
        body: "Your interviewer has begun the session. Stay in the interview room until the evaluation is complete.",
        tone: "warn",
        cta: { href: "/student/interviews", label: "Open interview details" },
      };
    }
    return {
      eyebrow: "Interview booked",
      title: "Prepare for your GRIT interview",
      body: `Your interview is scheduled for ${formatDateTime(
        activeInterview.booking.slot.startsAt,
      )} ${tzAbbreviation()}. Review the format and be ready five minutes before the start time.`,
      tone: "accent",
      cta: { href: "/student/interviews", label: "Review booking" },
    };
  }
  if (pendingResult) {
    return {
      eyebrow: "Result pending",
      title: "Your interview has been evaluated",
      body: "Your evaluation is complete and is awaiting publication by interview operations. You will be notified as soon as the result is published.",
      tone: "warn",
      cta: { href: "/student/interviews", label: "View interview" },
    };
  }
  if (approvedRetake) {
    return {
      eyebrow: "Retake approved",
      title: "Your retake is approved — book a new slot",
      body: "Interview operations approved an early retake. Choose a slot that gives you enough preparation time.",
      tone: "good",
      cta: { href: "/student/book", label: "Book retake" },
    };
  }
  if (badge?.status === "AWARDED") {
    return {
      eyebrow: "Badge clearance complete",
      title: "Your GRIT badge is active",
      body: `You hold the ${badge.badge.name} badge. Your interview result and badge record remain available for verification.`,
      tone: "good",
      cta: { href: "/student/badge", label: "View badge" },
    };
  }
  if (badge?.status === "SUSPENDED") {
    return {
      eyebrow: "Badge suspended",
      title: "Your badge is under operations review",
      body: "New bookings are paused while interview operations reviews your record. Your original interview result is unchanged.",
      tone: "warn",
      cta: { href: "/notifications", label: "Read notification" },
    };
  }
  if (publishedResult && (publishedResult.outcome === "FAIL" || publishedResult.outcome === "RETAKE_LATER")) {
    const eligibleFrom = latestPublished?.retakeEligibleFrom;
    return {
      eyebrow: "Another attempt recommended",
      title: pendingRetake
        ? "Your retake request is under review"
        : eligibleFrom && eligibleFrom > data.now
          ? `Your next attempt opens ${formatDate(eligibleFrom)}`
          : "You are eligible to book another attempt",
      body: pendingRetake
        ? "Interview operations has your request. You will be notified when a decision is made."
        : "Review the feedback from your last attempt, then book when your waiting period ends. You can request an earlier review if you need one.",
      tone: "warn",
      cta: { href: "/student/interviews", label: "Review feedback" },
    };
  }
  if (eligibility.allowed) {
    return {
      eyebrow: "Eligibility unlocked",
      title: "You are eligible for your GRIT interview",
      body: "Pick a time that works for you. Your slot is reserved the moment you confirm, and you can reschedule up to 4 hours before the interview.",
      tone: "accent",
      cta: { href: "/student/book", label: "Choose a slot" },
    };
  }
  return {
    eyebrow: "Booking unavailable",
    title: "A booking action is not available right now",
    body: eligibility.allowed ? "" : eligibility.message,
    tone: "neutral",
    cta: { href: "/student/interviews", label: "View interviews" },
  };
}
