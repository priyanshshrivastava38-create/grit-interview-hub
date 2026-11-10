import Link from "next/link";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { getStudentDashboard } from "@/lib/analytics";
import { JourneyTracker, type JourneyStep } from "@/components/journey";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  InfoBanner,
  PageHeader,
  Progress,
  SectionTitle,
  StatCard,
  StatusPill,
  TableCell,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";
import {
  formatLongDate,
  formatDate,
  formatDateTime,
  relativeTime,
  APP_TIMEZONE,
  timeInTz,
  tzAbbreviation,
} from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Student overview" };

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: APP_TIMEZONE }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function StudentOverviewPage() {
  const user = await requireStudent();
  const data = await getStudentDashboard(user.studentId);
  const { profile, skills, eligibility, activeInterview, latestPublished, badge } = data;

  const completedSkills = skills.filter((skill) => skill.status === "COMPLETED").length;
  const requiredSkills = skills.filter((skill) => skill.skill.isRequired).length;
  const attempts = data.history.length + data.upcoming.length;
  const firstName = profile.user.name.split(" ")[0];
  const publishedResult = latestPublished?.result;
  const pendingResult = data.history.find((interview) => interview.status === "RESULT_PENDING");
  const pendingRetake = data.retakes.find((retake) => retake.status === "PENDING");
  const approvedRetake = data.retakes.find((retake) => retake.status === "APPROVED");
  const badgeAward = badge;
  const missingSkills = skills.filter((skill) => skill.skill.isRequired && skill.status !== "COMPLETED");

  const journeySteps: JourneyStep[] = (() => {
    const skillsDone = missingSkills.length === 0;
    const revoked = profile.eligibilityStatus === "ELIGIBILITY_REVOKED";
    const isEligible = profile.eligibilityStatus === "ELIGIBLE";
    const hasBooked = Boolean(activeInterview) || data.history.length > 0;
    const resultPending = Boolean(pendingResult);
    const resultPublished = Boolean(publishedResult);
    const badgeState: JourneyStep["state"] = badgeAward
      ? badgeAward.status === "AWARDED"
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
        detail: badgeAward
          ? badgeAward.status.replaceAll("_", " ").toLowerCase()
          : publishedResult?.outcome === "PASS"
            ? "Awarding soon"
            : "After a pass",
        state: badgeState,
      },
    ];
  })();

  const nextAction = (() => {
    if (profile.eligibilityStatus === "ELIGIBILITY_REVOKED") {
      return {
        eyebrow: "Eligibility on hold",
        title: "Your eligibility is under review",
        body:
          profile.eligibilityReason ??
          "Interview operations has paused your eligibility. Check notifications or contact your program coordinator.",
        tone: "bad" as const,
        cta: { href: "/notifications", label: "Read notification" },
      };
    }
    if (profile.eligibilityStatus === "NOT_ELIGIBLE") {
      return {
        eyebrow: "Complete your milestones",
        title: `Finish ${missingSkills.length} required skill${missingSkills.length === 1 ? "" : "s"} to unlock interviews`,
        body: "Eligibility unlocks automatically when your remaining milestones are marked complete. Your progress below shows exactly what is outstanding.",
        tone: "info" as const,
        cta: { href: "#skills", label: "View requirements" },
      };
    }
    if (activeInterview) {
      if (activeInterview.status === "IN_PROGRESS") {
        return {
          eyebrow: "Interview in progress",
          title: "Your interview has started",
          body: "Your interviewer has begun the session. Stay in the interview room until the evaluation is complete.",
          tone: "warn" as const,
          cta: { href: "/student/interviews", label: "Open interview details" },
        };
      }
      return {
        eyebrow: "Interview booked",
        title: "Prepare for your GRIT interview",
        body: `Your interview is scheduled for ${formatDateTime(
          activeInterview.booking.slot.startsAt,
        )} ${tzAbbreviation()}. Review the format and be ready five minutes before the start time.`,
        tone: "accent" as const,
        cta: { href: "/student/interviews", label: "Review booking" },
      };
    }
    if (pendingResult) {
      return {
        eyebrow: "Result pending",
        title: "Your interview has been evaluated",
        body: "Your evaluation is complete and is awaiting publication by interview operations. You will be notified as soon as the result is published.",
        tone: "warn" as const,
        cta: { href: "/student/interviews", label: "View interview" },
      };
    }
    if (approvedRetake) {
      return {
        eyebrow: "Retake approved",
        title: "Your retake is approved — book a new slot",
        body: "Interview operations approved an early retake. Choose a slot that gives you enough preparation time.",
        tone: "good" as const,
        cta: { href: "/student/book", label: "Book retake" },
      };
    }
    if (badgeAward?.status === "AWARDED") {
      return {
        eyebrow: "Badge clearance complete",
        title: "Your GRIT badge is active",
        body: `You hold the ${badgeAward.badge.name} badge. Your interview result and badge record remain available for verification.`,
        tone: "good" as const,
        cta: { href: "/student/badge", label: "View badge" },
      };
    }
    if (badgeAward?.status === "SUSPENDED") {
      return {
        eyebrow: "Badge suspended",
        title: "Your badge is under operations review",
        body: "New bookings are paused while interview operations reviews your record. Your original interview result is unchanged.",
        tone: "warn" as const,
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
        tone: "warn" as const,
        cta: { href: "/student/interviews", label: "Review feedback" },
      };
    }
    if (eligibility.allowed) {
      return {
        eyebrow: "Eligibility unlocked",
        title: "You are eligible for your GRIT interview",
        body: "Pick a time that works for you. Your slot is reserved the moment you confirm, and you can reschedule up to 4 hours before the interview.",
        tone: "accent" as const,
        cta: { href: "/student/book", label: "Choose a slot" },
      };
    }
    return {
      eyebrow: "Booking unavailable",
      title: "A booking action is not available right now",
      body: eligibility.allowed ? "" : eligibility.message,
      tone: "neutral" as const,
      cta: { href: "/student/interviews", label: "View interviews" },
    };
  })();

  return (
    <div>
      <PageHeader
        eyebrow={`${profile.cohort} · ${profile.studentCode}`}
        title={`${greeting(data.now)}, ${firstName}`}
        description="Your eligibility, interview journey and badge clearance in one place."
        actions={
          <>
            <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
              <CalendarDays className="size-3.5" /> My interviews
            </Link>
            {eligibility.allowed ? (
              <Link href="/student/book" className={buttonClasses("primary", "sm")}>
                <CalendarPlus className="size-3.5" /> Book interview
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-4">
        <JourneyTracker steps={journeySteps} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 -z-10 size-56 rounded-full bg-accent-soft opacity-80 blur-2xl"
          />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-[11px] border",
                nextAction.tone === "good" && "border-[#c9e9d3] bg-good-soft text-good",
                nextAction.tone === "warn" && "border-[#f2ddb8] bg-warn-soft text-warn",
                nextAction.tone === "bad" && "border-[#f5cfcb] bg-bad-soft text-bad",
                nextAction.tone === "info" && "border-[#d5dffb] bg-info-soft text-info",
                nextAction.tone === "accent" && "border-[#c4e8df] bg-accent-soft text-accent",
                nextAction.tone === "neutral" && "border-line bg-canvas text-muted",
              )}
            >
              <Target className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                Next action · {nextAction.eyebrow}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{nextAction.title}</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">{nextAction.body}</p>
              <Link href={nextAction.cta.href} className={buttonClasses("primary", "sm", "mt-4")}>
                {nextAction.cta.label} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-line bg-[#fafaf7] sm:grid-cols-4">
            {[
              { label: "Eligibility", value: profile.eligibilityStatus.replaceAll("_", " ").toLowerCase() },
              { label: "Attempts", value: `${attempts} used` },
              { label: "Badge", value: badgeAward ? badgeAward.status.replaceAll("_", " ").toLowerCase() : "not earned" },
              { label: "Notifications", value: `${data.unreadNotifications} unread` },
            ].map((item) => (
              <div key={item.label} className="border-r border-line px-4 py-3 last:border-0">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{item.label}</p>
                <p className="mt-0.5 text-[12.5px] font-medium text-ink first-letter:uppercase">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Badge status"
            description="Badge clearance is tracked separately from interview results."
            action={<Award className="size-4 text-muted" />}
          />
          <CardBody>
            {badgeAward ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{badgeAward.badge.name}</p>
                    <p className="text-[11.5px] text-muted">
                      {badgeAward.badge.code} · {badgeAward.badge.level} level
                    </p>
                  </div>
                  <StatusPill value={badgeAward.status} />
                </div>
                <dl className="space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Awarded</dt>
                    <dd className="font-medium">{badgeAward.awardedAt ? formatDate(badgeAward.awardedAt) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Validity</dt>
                    <dd className="font-medium">{badgeAward.badge.validityMonths} months</dd>
                  </div>
                </dl>
                <Link href="/student/badge" className={buttonClasses("outline", "sm", "w-full")}>
                  View badge record
                </Link>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-canvas text-muted">
                  <Award className="size-5" />
                </div>
                <p className="mt-3 text-[13px] font-medium">Not earned yet</p>
                <p className="mx-auto mt-1 max-w-[220px] text-[12px] leading-5 text-muted">
                  Pass your GRIT interview to earn the Certified Product Engineer badge automatically.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="stagger-grid mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Skills complete"
          value={`${completedSkills}/${skills.length}`}
          detail={`${requiredSkills} required milestones`}
          icon={<GraduationCap className="size-4" />}
        />
        <StatCard
          label="Interviews booked"
          value={data.upcoming.length}
          detail={activeInterview ? formatDate(activeInterview.booking.slot.startsAt) : "No active booking"}
          icon={<CalendarDays className="size-4" />}
        />
        <StatCard
          label="Results published"
          value={data.history.filter((interview) => interview.status === "RESULT_PUBLISHED").length}
          detail={
            publishedResult
              ? publishedResult.outcome === "PASS"
                ? "Latest: pass"
                : publishedResult.outcome === "FAIL"
                  ? "Latest: fail"
                  : "Latest: retake later"
              : "No result yet"
          }
          tone={publishedResult?.outcome === "PASS" ? "good" : undefined}
          icon={<BookOpenCheck className="size-4" />}
        />
        <StatCard
          label="Preparation"
          value={activeInterview ? relativeTime(activeInterview.booking.slot.startsAt, data.now) : "—"}
          detail={activeInterview ? `with ${activeInterview.interviewer.user.name}` : "Next interview"}
          icon={<Clock className="size-4" />}
        />
      </div>

      {activeInterview ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader
            title="Upcoming interview"
            description={`${activeInterview.interviewType.name} · ${activeInterview.interviewType.durationMinutes} minutes`}
            action={<StatusPill value={activeInterview.status} />}
          />
          <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-wrap items-start gap-5">
              <div className="min-w-[120px] rounded-[12px] border border-line bg-[#fafaf7] px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  {formatLongDate(activeInterview.booking.slot.startsAt)}
                </p>
                <p className="mt-1 text-[26px] font-semibold tracking-tight tabular">
                  {timeInTz(activeInterview.booking.slot.startsAt)}
                </p>
                <p className="text-[11px] text-muted">{tzAbbreviation()}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={activeInterview.interviewer.user.name} />
                  <div>
                    <p className="text-[13px] font-medium">{activeInterview.interviewer.user.name}</p>
                    <p className="text-[11.5px] text-muted">
                      {activeInterview.interviewer.title} · {activeInterview.interviewer.specialty}
                    </p>
                  </div>
                </div>
                <p className="max-w-md text-[12.5px] leading-6 text-muted">{activeInterview.interviewType.description}</p>
              </div>
            </div>
            <div className="rounded-[12px] border border-line bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Before you join</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px] leading-5 text-ink-soft">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> Join five minutes before your start
                  time.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> Keep a stable connection and a quiet
                  space.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> Cancellations are allowed up to 4
                  hours before the interview.
                </li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
                  Manage booking
                </Link>
                <Link href="/student/interviews#reschedule" className={buttonClasses("ghost", "sm")}>
                  Reschedule
                </Link>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {pendingResult ? (
        <div className="mt-6">
          <InfoBanner tone="warn" title="Your result is pending publication">
            Your evaluation for {pendingResult.interviewType.name} was submitted on{" "}
            {pendingResult.completedAt ? formatDate(pendingResult.completedAt) : "your interview date"}. Interview
            operations publishes results after review. You will receive a notification with the outcome.
          </InfoBanner>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card id="skills" className="scroll-mt-20">
          <CardHeader
            title="Skill completion"
            description={`${completedSkills} of ${skills.length} milestones complete`}
            action={
              <Badge tone={profile.eligibilityStatus === "ELIGIBLE" ? "good" : "neutral"}>
                {profile.eligibilityStatus === "ELIGIBLE" ? "Eligibility unlocked" : "Requirements open"}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="text-muted">Required progress</span>
                <span className="font-medium tabular">
                  {completedSkills}/{skills.length}
                </span>
              </div>
              <Progress value={(completedSkills / Math.max(skills.length, 1)) * 100} tone={completedSkills === skills.length ? "good" : "accent"} />
            </div>
            <ul className="divide-y divide-line">
              {skills.map((skill) => {
                const complete = skill.status === "COMPLETED";
                const inProgress = skill.status === "IN_PROGRESS";
                return (
                  <li key={skill.id} className="flex items-start gap-3 py-2.5">
                    {complete ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" />
                    ) : inProgress ? (
                      <Circle className="mt-0.5 size-4 shrink-0 text-warn" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-zinc-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("text-[13px] font-medium", complete ? "text-ink" : "text-ink-soft")}>
                          {skill.skill.name}
                        </p>
                        <Badge tone={complete ? "good" : inProgress ? "warn" : "neutral"}>
                          {complete ? "Completed" : inProgress ? "In progress" : "Not started"}
                        </Badge>
                        {!skill.skill.isRequired ? <Badge tone="neutral">Optional</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-5 text-muted">{skill.skill.description}</p>
                    </div>
                    {skill.score ? (
                      <span className="text-[12px] font-medium tabular text-ink-soft">{skill.score}%</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="rounded-lg bg-[#fafaf7] px-3 py-2 text-[11.5px] leading-5 text-muted">
              {profile.eligibilityReason ??
                "Eligibility is derived from the required skill milestones and can also be adjusted by interview operations."}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent notifications"
            action={
              <Link href="/notifications" className="text-[12px] font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <CardBody className="p-0">
            {data.notifications.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={<Bell className="size-4" />}
                title="No updates yet"
                description="You will be notified when anything changes."
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.notifications.slice(0, 4).map((notification) => (
                  <li key={notification.id} className="px-5 py-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          notification.readAt ? "bg-zinc-300" : "bg-accent",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-ink">{notification.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-muted">{notification.body}</p>
                        <p className="mt-1 text-[10.5px] text-zinc-400">{relativeTime(notification.createdAt, data.now)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle
          title="Interview history"
          description="Every attempt and its published outcome."
          action={
            <Link href="/student/interviews" className="text-[12px] font-medium text-accent hover:underline">
              Open full history
            </Link>
          }
        />
        {data.history.length === 0 ? (
          <Card>
            <EmptyState
              className="py-8"
              icon={<BookOpenCheck className="size-4" />}
              title="No completed interviews yet"
              description="Your completed interviews, evaluations and outcomes will appear here."
            />
          </Card>
        ) : (
          <TableShell>
            <TableHead>
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interview</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Date</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interviewer</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Score</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Status</TableCell>
              </TableRow>
            </TableHead>
            <tbody>
              {data.history.slice(0, 6).map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>
                    <p className="text-[13px] font-medium">{interview.interviewType.name}</p>
                    <p className="text-[11px] text-muted">Attempt {interview.attemptNumber}</p>
                  </TableCell>
                  <TableCell className="text-[12.5px]">{formatDate(interview.booking.slot.startsAt)}</TableCell>
                  <TableCell className="text-[12.5px]">{interview.interviewer.user.name}</TableCell>
                  <TableCell className="text-[12.5px] tabular">
                    {interview.result?.overallScore ?? interview.evaluation?.overallScore ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      value={
                        interview.booking.status === "NO_SHOW"
                          ? "NO_SHOW"
                          : (interview.result?.outcome ?? interview.status)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      {publishedResult && publishedResult.outcome !== "PASS" ? (
        <div className="mt-6">
          <InfoBanner
            tone={publishedResult.outcome === "FAIL" ? "bad" : "warn"}
            title={
              publishedResult.outcome === "FAIL"
                ? "This attempt did not clear the bar"
                : "A further attempt is recommended"
            }
            action={
              <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
                <Sparkles className="size-3.5" /> Review feedback
              </Link>
            }
          >
            {latestPublished?.retakeEligibleFrom && latestPublished.retakeEligibleFrom > data.now
              ? `Your next eligible attempt date is ${formatDate(latestPublished.retakeEligibleFrom)}. You can request an earlier review from your interview details.`
              : "Your next attempt window is open. Book a new slot when you are ready."}
          </InfoBanner>
        </div>
      ) : null}
    </div>
  );
}
