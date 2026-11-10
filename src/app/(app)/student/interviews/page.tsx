import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  MessageSquareText,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { getStudentDashboard } from "@/lib/analytics";
import { BOOKING_POLICY } from "@/lib/booking-eligibility";
import { prisma } from "@/lib/db";
import { cancelBookingAction, requestRetakeAction, rescheduleBookingAction } from "@/app/actions/student";
import { ActionForm, Modal } from "@/components/action-form";
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
  StatRow,
  StatusPill,
  inputClasses,
  selectClasses,
} from "@/components/ui";
import {
  dateKeyInTz,
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatLongDate,
  hoursUntil,
  minutesBetween,
  timeInTz,
  tzAbbreviation,
} from "@/lib/time";
import { cn, scoreTone } from "@/lib/utils";

export const metadata = { title: "My interviews" };

function ScoreLine({ label, value }: { label: string; value: number }) {
  const tone = scoreTone(value);
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular">{value}</span>
      </div>
      <Progress
        value={value}
        className="mt-1 h-1"
        tone={tone === "good" ? "good" : tone === "warn" ? "warn" : "bad"}
      />
    </div>
  );
}

export default async function StudentInterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  const user = await requireStudent();
  const params = await searchParams;
  const data = await getStudentDashboard(user.studentId);
  const active = data.activeInterview;
  const now = data.now;

  const canChange =
    active &&
    active.booking.status === "CONFIRMED" &&
    !active.evaluation &&
    !active.result &&
    hoursUntil(active.booking.slot.startsAt, now) >= BOOKING_POLICY.cancellationHours;

  const [alternativeRaw, bookings] = await Promise.all([
    canChange
      ? prisma.interviewSlot.findMany({
          where: {
            status: "OPEN",
            interviewer: { isActive: true },
            availability: { status: "ACTIVE" },
            startsAt: { gte: now },
            id: { not: active.booking.slotId },
          },
          include: { interviewer: { include: { user: { select: { name: true } } } } },
          orderBy: { startsAt: "asc" },
          take: 220,
        })
      : Promise.resolve([]),
    prisma.interviewBooking.findMany({
      where: { studentId: user.studentId },
      include: {
        slot: { include: { interviewer: { include: { user: { select: { name: true } } } } } },
        interview: { select: { id: true } },
      },
      orderBy: { bookedAt: "desc" },
    }),
  ]);

  const alternatives = alternativeRaw
    .filter((slot) => slot.startsAt.getTime() - now.getTime() >= BOOKING_POLICY.minimumLeadMinutes * 60_000)
    .filter((slot) => slot.startsAt.getTime() - now.getTime() > 0);

  const altDays = new Map<string, typeof alternatives>();
  for (const slot of alternatives) {
    const key = dateKeyInTz(slot.startsAt);
    const list = altDays.get(key) ?? [];
    list.push(slot);
    altDays.set(key, list);
  }
  const altDateKeys = Array.from(altDays.keys()).sort().slice(0, 5);

  const publishedInterviews = data.history
    .filter((interview) => interview.result && interview.resultPublishedAt)
    .sort(
      (a, b) => (b.resultPublishedAt?.getTime() ?? 0) - (a.resultPublishedAt?.getTime() ?? 0),
    );
  const lastPublished = publishedInterviews[0] ?? null;
  const lastPendingRetake = lastPublished
    ? data.retakes.find((retake) => retake.interviewTypeId === lastPublished.interviewTypeId)
    : null;
  const retakeWindowOpen =
    lastPublished?.outcome !== "PASS" &&
    Boolean(lastPublished?.retakeEligibleFrom && lastPublished.retakeEligibleFrom <= now);
  const retakeWaiting =
    lastPublished?.outcome !== "PASS" &&
    Boolean(lastPublished?.retakeEligibleFrom && lastPublished.retakeEligibleFrom > now);

  return (
    <div>
      <PageHeader
        eyebrow="Student · Interviews"
        title="My interviews"
        description="Your confirmed booking, published outcomes, structured feedback and retake path."
        actions={
          data.eligibility.allowed ? (
            <Link href="/student/book" className={buttonClasses("primary", "sm")}>
              <CalendarPlus className="size-3.5" /> Book another interview
            </Link>
          ) : (
            <Link href="/student" className={buttonClasses("outline", "sm")}>
              Back to overview
            </Link>
          )
        }
      />

      {params.booked === "1" && active ? (
        <div className="mb-5">
          <InfoBanner
            tone="good"
            title="Interview confirmed"
            action={
              <Link href="/student" className={buttonClasses("outline", "sm")}>
                Back to dashboard
              </Link>
            }
          >
            Your GRIT interview is confirmed for{" "}
            <span className="font-medium text-ink">
              {formatLongDate(active.booking.slot.startsAt)} at {timeInTz(active.booking.slot.startsAt)}{" "}
              {tzAbbreviation()}
            </span>{" "}
            with {active.interviewer.user.name}. Your booking details are below.
          </InfoBanner>
        </div>
      ) : null}

      {active ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Confirmed booking"
            description={`${active.interviewType.name} · attempt ${active.attemptNumber} of ${active.interviewType.maxAttempts}`}
            action={<StatusPill value={active.status} />}
          />
          <div className="grid gap-6 p-5 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="flex flex-wrap items-start gap-5">
                <div className="rounded-[12px] border border-line bg-[#fafaf7] px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    {formatLongDate(active.booking.slot.startsAt)}
                  </p>
                  <p className="mt-1 text-[28px] font-semibold leading-8 tracking-tight tabular">
                    {timeInTz(active.booking.slot.startsAt)}
                  </p>
                  <p className="text-[11px] text-muted">
                    to {timeInTz(active.booking.slot.endsAt)} · {minutesBetween(active.booking.slot.startsAt, active.booking.slot.endsAt)} min · {tzAbbreviation()}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={active.interviewer.user.name} />
                    <div>
                      <p className="text-[13px] font-medium">{active.interviewer.user.name}</p>
                      <p className="text-[11.5px] text-muted">
                        {active.interviewer.title} · {active.interviewer.specialty}
                      </p>
                    </div>
                  </div>
                  <p className="max-w-md text-[12.5px] leading-6 text-muted">{active.interviewType.description}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[12px] border border-line bg-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Before you join</p>
                <ul className="mt-2 space-y-1.5 text-[12.5px] leading-5 text-ink-soft">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> Join five minutes before your
                    start time and keep a stable connection.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> Your interviewer will start the
                    session from their workspace.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> Changes close{" "}
                    {BOOKING_POLICY.cancellationHours} hours before the interview.
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-[12px] border border-line bg-[#fafaf7] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Manage booking</p>
              {canChange ? (
                <div className="mt-3 space-y-2">
                  <div id="reschedule" className="scroll-mt-24">
                    <Modal
                      title="Reschedule interview"
                      description="Your original booking stays in your history. The new time is reserved as soon as you confirm."
                      trigger={
                        <>
                          <CalendarClock className="size-3.5" /> Reschedule
                        </>
                      }
                      triggerClassName="w-full"
                      wide
                    >
                      {alternativeRaw.length === 0 ? (
                        <p className="text-[13px] text-muted">
                          No alternative slots are currently available. Contact interview operations if you need help.
                        </p>
                      ) : (
                        <ActionForm
                          action={rescheduleBookingAction}
                          successMessage="Interview rescheduled"
                          className="space-y-4"
                        >
                          <input type="hidden" name="bookingId" value={active.booking.id} />
                          <label htmlFor="newSlotId" className="block text-[13px] font-medium text-ink-soft">
                            New time
                          </label>
                          <select id="newSlotId" name="newSlotId" required className={selectClasses} defaultValue="">
                            <option value="" disabled>
                              Choose a new slot
                            </option>
                            {altDateKeys.map((key) => (
                              <optgroup key={key} label={formatDayLabel(new Date(`${key}T00:00:00.000Z`))}>
                                {(altDays.get(key) ?? []).map((slot) => (
                                  <option key={slot.id} value={slot.id}>
                                    {timeInTz(slot.startsAt)} · {slot.interviewer.user.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <p className="text-[11.5px] leading-5 text-muted">
                            Only the next five available days are shown. All times are in {tzAbbreviation()}.
                          </p>
                          <button type="submit" className={buttonClasses("primary", "md", "w-full")}>
                            Confirm new time
                          </button>
                        </ActionForm>
                      )}
                    </Modal>
                  </div>

                  <Modal
                    title="Cancel interview"
                    description="The slot is released and your booking is retained in history."
                    trigger={
                      <>
                        <XCircle className="size-3.5" /> Cancel booking
                      </>
                    }
                    triggerClassName="w-full text-bad"
                  >
                    <ActionForm action={cancelBookingAction} successMessage="Interview cancelled" className="space-y-4">
                      <input type="hidden" name="bookingId" value={active.booking.id} />
                      <div className="rounded-lg border border-[#f2ddb8] bg-warn-soft px-3 py-2 text-[12px] leading-5 text-warn">
                        Cancelling releases this slot. You will be able to book a new time immediately.
                      </div>
                      <label htmlFor="cancel-reason" className="block text-[13px] font-medium text-ink-soft">
                        Reason <span className="font-normal text-muted">(optional)</span>
                      </label>
                      <textarea
                        id="cancel-reason"
                        name="reason"
                        rows={3}
                        maxLength={500}
                        className={cn(inputClasses, "h-auto py-2")}
                        placeholder="Let operations know why you are cancelling."
                      />
                      <button type="submit" className={buttonClasses("danger", "md", "w-full")}>
                        Cancel this interview
                      </button>
                    </ActionForm>
                  </Modal>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] leading-5 text-muted">
                    {active.evaluation || active.result
                      ? "This interview already has a recorded evaluation, so it can no longer be changed."
                      : `Changes are closed within ${BOOKING_POLICY.cancellationHours} hours of the start time. Contact interview operations for urgent changes.`}
                  </p>
                  <p className="text-[11.5px] text-muted">
                    Starts {formatDateTime(active.booking.slot.startsAt)}.
                  </p>
                </div>
              )}

              <div className="mt-4 border-t border-line pt-3">
                <StatRow
                  className="justify-between"
                  items={[
                    { label: "Booking", value: <StatusPill value={active.booking.status} /> },
                    { label: "Type", value: active.interviewType.code },
                    { label: "Attempt", value: active.attemptNumber },
                  ]}
                />
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="No confirmed booking"
            description="Your next interview appears here with joining instructions."
            action={<StatusPill value="AVAILABLE" />}
          />
          <EmptyState
            icon={<CalendarDays className="size-4" />}
            title={data.eligibility.allowed ? "You have no active interview" : "Booking is currently unavailable"}
            description={
              data.eligibility.allowed
                ? "Choose an available slot to continue your badge clearance journey."
                : data.eligibility.message
            }
            action={
              data.eligibility.allowed ? (
                <Link href="/student/book" className={buttonClasses("primary", "sm")}>
                  Choose a slot <ArrowRight className="size-3.5" />
                </Link>
              ) : null
            }
          />
        </Card>
      )}

      {lastPendingRetake && lastPublished?.status !== "RESULT_PUBLISHED" ? null : null}
      {data.history.some((interview) => interview.status === "RESULT_PENDING") ? (
        <div className="mt-5">
          <InfoBanner
            tone="warn"
            title="A result is awaiting publication"
            action={
              <Link href="/student" className={buttonClasses("outline", "sm")}>
                Open dashboard
              </Link>
            }
          >
            Interview operations has your evaluation and will publish the result after review. No action is required
            from you.
          </InfoBanner>
        </div>
      ) : null}

      <div className="mt-8">
        <SectionTitle
          title="Your interview record"
          description="Published results, evaluation feedback and the retake state of each attempt."
        />
        {data.history.length === 0 ? (
          <Card>
            <EmptyState
              icon={<History className="size-4" />}
              title="No interview outcomes yet"
              description="After your interview, the evaluation and published result will appear here."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {data.history.map((interview) => {
              const result = interview.result;
              const evaluation = interview.evaluation;
              const showFeedback = Boolean(result && evaluation);
              const isNoShow = interview.booking.status === "NO_SHOW";
              return (
                <Card key={interview.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold">{interview.interviewType.name}</h3>
                        <Badge tone="neutral">Attempt {interview.attemptNumber}</Badge>
                        <StatusPill
                          value={isNoShow ? "NO_SHOW" : (result?.outcome ?? interview.status)}
                        />
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {formatDateTime(interview.booking.slot.startsAt)} · {interview.interviewer.user.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Overall</p>
                      <p className="text-xl font-semibold tabular">
                        {result?.overallScore ?? evaluation?.overallScore ?? "—"}
                      </p>
                    </div>
                  </div>

                  <CardBody className="space-y-4">
                    {isNoShow ? (
                      <div className="flex items-start gap-2.5 rounded-lg border border-[#f5cfcb] bg-bad-soft px-3 py-2.5 text-[12.5px] text-bad">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                        You did not attend this interview. Interview operations recorded a no-show. Contact them if
                        this is incorrect.
                      </div>
                    ) : null}

                    {interview.status === "RESULT_PENDING" ? (
                      <div className="flex items-start gap-2.5 rounded-lg border border-[#f2ddb8] bg-warn-soft px-3 py-2.5 text-[12.5px] leading-5 text-warn">
                        <Clock className="mt-0.5 size-4 shrink-0" />
                        Evaluation submitted. The result is awaiting publication by interview operations.
                      </div>
                    ) : null}

                    {result ? (
                      <div
                        className={cn(
                          "rounded-[11px] border px-4 py-3",
                          result.outcome === "PASS" && "border-[#c9e9d3] bg-good-soft",
                          result.outcome === "FAIL" && "border-[#f5cfcb] bg-bad-soft",
                          result.outcome === "RETAKE_LATER" && "border-[#f2ddb8] bg-warn-soft",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {result.outcome === "PASS" ? (
                            <CheckCircle2 className="size-4 text-good" />
                          ) : result.outcome === "FAIL" ? (
                            <XCircle className="size-4 text-bad" />
                          ) : (
                            <RotateCcw className="size-4 text-warn" />
                          )}
                          <p className="text-[13px] font-semibold">
                            {result.outcome === "PASS"
                              ? "Passed — badge clearance complete"
                              : result.outcome === "FAIL"
                                ? "Not cleared on this attempt"
                                : "Another attempt recommended"}
                          </p>
                          <span className="ml-auto text-[11px] text-muted">
                            Published {formatDate(result.publishedAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-6 text-ink-soft">{result.feedbackSummary}</p>
                        {result.outcome === "PASS" ? (
                          <Link
                            href="/student/badge"
                            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-good hover:underline"
                          >
                            <Award className="size-3.5" /> View your badge
                          </Link>
                        ) : interview.retakeEligibleFrom ? (
                          <p className="mt-2 text-[12px] text-ink-soft">
                            Next eligible attempt:{" "}
                            <span className="font-medium">{formatDate(interview.retakeEligibleFrom)}</span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {showFeedback ? (
                      <details className="group rounded-[11px] border border-line bg-[#fafaf7]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[12.5px] font-medium text-ink-soft">
                          <span className="inline-flex items-center gap-2">
                            <MessageSquareText className="size-3.5 text-muted" /> Structured evaluation feedback
                          </span>
                          <span className="text-[11px] text-muted group-open:hidden">Open</span>
                          <span className="hidden text-[11px] text-muted group-open:inline">Close</span>
                        </summary>
                        <div className="border-t border-line px-4 py-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <ScoreLine label="Technical" value={evaluation!.technicalScore} />
                            <ScoreLine label="Problem solving" value={evaluation!.problemSolvingScore} />
                            <ScoreLine label="Communication" value={evaluation!.communicationScore} />
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                                Strengths
                              </p>
                              <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{evaluation!.strengths}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                                Areas to improve
                              </p>
                              <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{evaluation!.improvements}</p>
                            </div>
                          </div>
                          {evaluation!.notes ? (
                            <div className="mt-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                                Interview notes
                              </p>
                              <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{evaluation!.notes}</p>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {lastPublished && lastPublished.outcome !== "PASS" ? (
        <Card className="mt-6">
          <CardHeader
            title="Retake pathway"
            description="Appeals are reviewed by interview operations; approval allows booking before the standard waiting period."
            action={<Badge tone={retakeWindowOpen ? "good" : retakeWaiting ? "warn" : "neutral"}>{lastPublished.outcome === "FAIL" ? "Fail" : "Retake later"}</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-line bg-[#fafaf7] px-4 py-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Next eligible attempt</p>
                <p className="mt-0.5 text-[14px] font-semibold">
                  {lastPublished.retakeEligibleFrom
                    ? formatLongDate(lastPublished.retakeEligibleFrom)
                    : "Eligible now"}
                </p>
              </div>
              {lastPendingRetake ? (
                <div className="text-right">
                  <StatusPill value={lastPendingRetake.status} />
                  {lastPendingRetake.reviewedAt ? (
                    <p className="mt-1 text-[11px] text-muted">
                      Reviewed {formatDate(lastPendingRetake.reviewedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {lastPendingRetake ? (
              <div className="text-[12.5px] leading-6 text-ink-soft">
                <p className="font-medium text-ink">
                  {lastPendingRetake.status === "PENDING"
                    ? "Your retake request is under review."
                    : lastPendingRetake.status === "APPROVED"
                      ? "Your early retake was approved. You can book a new slot now."
                      : lastPendingRetake.status === "REJECTED"
                        ? "Your retake request was declined."
                        : "This retake has been scheduled."}
                </p>
                <p className="mt-1 text-muted">
                  Requested {formatRelative(lastPendingRetake.createdAt, now)} · {lastPendingRetake.reason}
                </p>
                {lastPendingRetake.decisionNote ? (
                  <p className="mt-1 text-muted">Operations note: {lastPendingRetake.decisionNote}</p>
                ) : null}
                {lastPendingRetake.status === "PENDING" || retakeWindowOpen || lastPendingRetake.status === "APPROVED" ? (
                  <Link href="/student/book" className={buttonClasses("outline", "sm", "mt-3")}>
                    <CalendarPlus className="size-3.5" /> Book a slot
                  </Link>
                ) : null}
              </div>
            ) : retakeWindowOpen || data.retakes.some((retake) => retake.status === "APPROVED") ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#c9e9d3] bg-good-soft px-4 py-3">
                <p className="text-[12.5px] text-good">
                  Your retake window is open. Book a new slot when you are ready.
                </p>
                <Link href="/student/book" className={buttonClasses("primary", "sm")}>
                  Book retake
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] leading-6 text-muted">
                  You can request an earlier review if you have a documented reason, such as illness or a schedule
                  conflict.
                </p>
                <Modal
                  title="Request an earlier retake"
                  description="Interview operations reviews every request. Approval allows you to book before the standard waiting period."
                  trigger={
                    <>
                      <RotateCcw className="size-3.5" /> Request earlier retake
                    </>
                  }
                >
                  <ActionForm action={requestRetakeAction} successMessage="Retake request submitted" className="space-y-4">
                    <input type="hidden" name="interviewTypeId" value={lastPublished.interviewTypeId} />
                    <label htmlFor="retake-reason" className="block text-[13px] font-medium text-ink-soft">
                      Why do you need an earlier attempt?
                    </label>
                    <textarea
                      id="retake-reason"
                      name="reason"
                      rows={4}
                      required
                      minLength={15}
                      maxLength={1000}
                      className={cn(inputClasses, "h-auto py-2")}
                      placeholder="Explain the circumstances and any preparation completed since the last attempt."
                    />
                    <button type="submit" className={buttonClasses("primary", "md", "w-full")}>
                      Submit request
                    </button>
                  </ActionForm>
                </Modal>
              </div>
            )}

            {data.retakes.filter((retake) => retake.status !== "PENDING").length > 0 ? (
              <div className="border-t border-line pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Retake history</p>
                <ul className="mt-2 space-y-2">
                  {data.retakes
                    .filter((retake) => retake.status !== "PENDING")
                    .map((retake) => (
                      <li key={retake.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                        <span className="text-muted">
                          {retake.interviewType.name} · requested {formatDate(retake.createdAt)}
                        </span>
                        <StatusPill value={retake.status} />
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-8">
        <SectionTitle
          title="Booking history"
          description="Every booking record, including cancelled and rescheduled attempts."
        />
        <Card>
          <ul className="divide-y divide-line">
            {bookings.map((booking) => (
              <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="w-[150px] shrink-0">
                  <p className="text-[12.5px] font-medium">{formatDate(booking.slot.startsAt)}</p>
                  <p className="text-[11px] text-muted">
                    {timeInTz(booking.slot.startsAt)} · {booking.slot.interviewer.user.name}
                  </p>
                </div>
                <div className="min-w-0 flex-1 text-[11.5px] text-muted">
                  Booked {formatDate(booking.bookedAt)} · attempt {booking.attemptNumber}
                  {booking.cancellationReason ? ` · ${booking.cancellationReason}` : ""}
                </div>
                <StatusPill value={booking.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function formatRelative(date: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
