import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Info,
  LockKeyhole,
  PlayCircle,
} from "lucide-react";
import { requireInterviewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startInterviewAction, submitEvaluationAction } from "@/app/actions/interviewer";
import { ActionForm } from "@/components/action-form";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  Field,
  InfoBanner,
  KeyValue,
  PageHeader,
  Progress,
  StatusPill,
  inputClasses,
} from "@/components/ui";
import { formatDate, formatDateTime, formatLongDate, minutesBetween, timeInTz, tzAbbreviation } from "@/lib/time";
import { cn, scoreTone } from "@/lib/utils";

export const metadata = { title: "Interview brief" };

function ScoreDisplay({ label, value }: { label: string; value: number }) {
  const tone = scoreTone(value);
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular">{value}</span>
      </div>
      <Progress
        value={value}
        className="mt-1"
        tone={tone === "good" ? "good" : tone === "warn" ? "warn" : "bad"}
      />
    </div>
  );
}

export default async function InterviewerInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireInterviewer();
  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user: true,
          skills: { include: { skill: true } },
          badgeAwards: { include: { badge: true } },
        },
      },
      interviewer: { include: { user: true } },
      interviewType: true,
      booking: { include: { slot: true } },
      evaluation: true,
      result: true,
      badgeAward: true,
    },
  });

  if (!interview || interview.interviewerId !== user.interviewerId) notFound();

  const now = new Date();
  const isUpcoming = interview.booking.slot.startsAt > now;
  const canEvaluate =
    !interview.evaluation &&
    ["SCHEDULED", "IN_PROGRESS"].includes(interview.status) &&
    interview.booking.status !== "NO_SHOW";
  const skills = interview.student.skills
    .slice()
    .sort((a, b) => a.skill.sortOrder - b.skill.sortOrder);
  const completedSkills = skills.filter((skill) => skill.status === "COMPLETED").length;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/interviewer/interviews"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to schedule
        </Link>
      </div>

      <PageHeader
        eyebrow={`${formatLongDate(interview.booking.slot.startsAt)} · ${timeInTz(
          interview.booking.slot.startsAt,
        )} ${tzAbbreviation()}`}
        title={interview.student.user.name}
        description={`${interview.interviewType.name} · ${interview.interviewType.durationMinutes} minutes · attempt ${interview.attemptNumber}`}
        actions={<StatusPill value={interview.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.35fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Student profile" action={<GraduationCap className="size-4 text-muted" />} />
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={interview.student.user.name} className="size-11 text-[13px]" />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{interview.student.user.name}</p>
                  <p className="text-[11.5px] text-muted">{interview.student.studentCode}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-0.5">
                <KeyValue label="Programme" value={interview.student.program} />
                <KeyValue label="Cohort" value={interview.student.cohort} />
                <KeyValue label="University" value={interview.student.university} />
                <KeyValue label="Eligibility" value={<StatusPill value={interview.student.eligibilityStatus} />} />
                <KeyValue label="Prior attempts" value={Math.max(0, interview.attemptNumber - 1)} />
              </dl>
              {interview.student.badgeAwards.length > 0 ? (
                <div className="mt-3 rounded-lg border border-line bg-[#fafaf7] px-3 py-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Existing badge</p>
                  {interview.student.badgeAwards.map((award) => (
                    <p key={award.id} className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="truncate">{award.badge.name}</span>
                      <StatusPill value={award.status} />
                    </p>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Skill readiness"
              description={`${completedSkills} of ${skills.length} milestones complete`}
            />
            <CardBody className="space-y-2">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-start gap-2.5">
                  {skill.status === "COMPLETED" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-good" />
                  ) : (
                    <span className="mt-1 size-2 shrink-0 rounded-full border border-zinc-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-ink-soft">{skill.skill.name}</p>
                      <span className="text-[10.5px] text-muted">
                        {skill.status === "COMPLETED" ? `${skill.score ?? "—"}%` : skill.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card className="bg-[#fafaf7]">
            <CardBody className="space-y-2 text-[11.5px] leading-5 text-muted">
              <p className="flex items-center gap-1.5 font-medium text-ink-soft">
                <LockKeyhole className="size-3.5" /> Access control
              </p>
              <p>
                Only the interviewer assigned to this interview can start it or submit an evaluation. This is enforced
                on the server for every request.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Session details"
              description="Review the format before you begin."
              action={<CalendarDays className="size-4 text-muted" />}
            />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Date</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold">{formatDate(interview.booking.slot.startsAt)}</p>
                </div>
                <div className="rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Time</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold">{formatDateTime(interview.booking.slot.startsAt)}</p>
                </div>
                <div className="rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Duration</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold">
                    {minutesBetween(interview.booking.slot.startsAt, interview.booking.slot.endsAt)} minutes
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-6 text-muted">{interview.interviewType.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {interview.status === "SCHEDULED" ? (
                  <ActionForm action={startInterviewAction} successMessage="Interview started">
                    <input type="hidden" name="interviewId" value={interview.id} />
                    <button type="submit" className={buttonClasses("primary", "md")}>
                      <PlayCircle className="size-4" /> Start interview
                    </button>
                  </ActionForm>
                ) : (
                  <Badge tone={interview.status === "IN_PROGRESS" ? "warn" : "neutral"} dot>
                    {interview.status === "IN_PROGRESS" ? "Session in progress" : "Session recorded"}
                  </Badge>
                )}
                {isUpcoming ? (
                  <span className="text-[11.5px] text-muted">
                    Scheduled for {formatDateTime(interview.booking.slot.startsAt)}
                  </span>
                ) : null}
              </div>
            </CardBody>
          </Card>

          {interview.evaluation ? (
            <>
              {interview.result ? (
                <InfoBanner
                  tone={
                    interview.result.outcome === "PASS"
                      ? "good"
                      : interview.result.outcome === "FAIL"
                        ? "bad"
                        : "warn"
                  }
                  title={`Result published · ${interview.result.outcome.replaceAll("_", " ").toLowerCase()}`}
                  action={<Badge tone="neutral">{formatDate(interview.result.publishedAt)}</Badge>}
                >
                  {interview.result.feedbackSummary}
                </InfoBanner>
              ) : (
                <InfoBanner tone="warn" title="Evaluation submitted — awaiting publication">
                  Interview operations will review and publish the result. Your scores and feedback are locked for
                  audit.
                </InfoBanner>
              )}

              <Card>
                <CardHeader
                  title="Submitted evaluation"
                  description={`Submitted ${
                    interview.evaluation.submittedAt
                      ? interview.evaluation.submittedAt.toLocaleString("en-GB", { timeZone: user.timezone })
                      : ""
                  }`}
                  action={<StatusPill value={interview.evaluation.recommendation} />}
                />
                <CardBody className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ScoreDisplay label="Technical knowledge" value={interview.evaluation.technicalScore} />
                    <ScoreDisplay label="Problem solving" value={interview.evaluation.problemSolvingScore} />
                    <ScoreDisplay label="Communication" value={interview.evaluation.communicationScore} />
                  </div>
                  <div className="flex items-center justify-between rounded-[10px] border border-line bg-[#fafaf7] px-4 py-3">
                    <span className="text-[12px] font-medium text-ink-soft">Overall score</span>
                    <span className="text-xl font-semibold tabular">{interview.evaluation.overallScore}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Strengths</p>
                      <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{interview.evaluation.strengths}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                        Areas for improvement
                      </p>
                      <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{interview.evaluation.improvements}</p>
                    </div>
                  </div>
                  {interview.evaluation.notes ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Interview notes</p>
                      <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{interview.evaluation.notes}</p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </>
          ) : canEvaluate ? (
            <Card>
              <CardHeader
                title="Structured evaluation"
                description="Score the interview, capture evidence and recommend an outcome. This completes the interview."
                action={<ClipboardCheck className="size-4 text-muted" />}
              />
              <CardBody>
                {isUpcoming ? (
                  <div className="mb-4">
                    <InfoBanner tone="info" title="Scheduled session">
                      This interview is scheduled for {formatDateTime(interview.booking.slot.startsAt)}. Record the
                      evaluation only after the session has taken place.
                    </InfoBanner>
                  </div>
                ) : null}
                <ActionForm
                  action={submitEvaluationAction}
                  successMessage="Evaluation submitted to interview operations"
                  className="space-y-5"
                >
                  <input type="hidden" name="interviewId" value={interview.id} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Technical knowledge" hint="0–100">
                      <input
                        type="number"
                        name="technicalScore"
                        min={0}
                        max={100}
                        required
                        defaultValue={70}
                        className={inputClasses}
                      />
                    </Field>
                    <Field label="Problem solving" hint="0–100">
                      <input
                        type="number"
                        name="problemSolvingScore"
                        min={0}
                        max={100}
                        required
                        defaultValue={70}
                        className={inputClasses}
                      />
                    </Field>
                    <Field label="Communication" hint="0–100">
                      <input
                        type="number"
                        name="communicationScore"
                        min={0}
                        max={100}
                        required
                        defaultValue={70}
                        className={inputClasses}
                      />
                    </Field>
                  </div>
                  <p className="rounded-lg bg-[#fafaf7] px-3 py-2 text-[11.5px] leading-5 text-muted">
                    The overall score is the average of the three dimensions. Scores must be whole numbers between 0
                    and 100.
                  </p>
                  <Field label="Strengths" hint="What did the student do well? (10 characters minimum)">
                    <textarea
                      name="strengths"
                      rows={3}
                      required
                      minLength={10}
                      className={cn(inputClasses, "h-auto py-2")}
                      placeholder="Evidence of strong reasoning, communication or production judgement."
                    />
                  </Field>
                  <Field label="Areas for improvement" hint="Specific, actionable feedback (10 characters minimum)">
                    <textarea
                      name="improvements"
                      rows={3}
                      required
                      minLength={10}
                      className={cn(inputClasses, "h-auto py-2")}
                      placeholder="What should the student work on before another attempt?"
                    />
                  </Field>
                  <Field label="Interview notes" hint="Optional internal notes retained in the audit record">
                    <textarea
                      name="notes"
                      rows={2}
                      className={cn(inputClasses, "h-auto py-2")}
                      placeholder="Context for interview operations."
                    />
                  </Field>

                  <fieldset>
                    <legend className="text-[13px] font-medium text-ink-soft">Final recommendation</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          value: "PASS",
                          label: "Pass",
                          description: "Clear the bar; award the badge on publication.",
                        },
                        {
                          value: "FAIL",
                          label: "Fail",
                          description: "Not cleared; retake after the waiting period.",
                        },
                        {
                          value: "RETAKE_LATER",
                          label: "Retake later",
                          description: "Recommended after further preparation.",
                        },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className="flex cursor-pointer gap-2 rounded-[10px] border border-line bg-surface px-3 py-2.5 hover:border-line-strong has-[:checked]:border-accent/50 has-[:checked]:bg-accent-soft"
                        >
                          <input
                            type="radio"
                            name="recommendation"
                            value={option.value}
                            required
                            className="mt-0.5 accent-[#0f766e]"
                          />
                          <span>
                            <span className="block text-[12px] font-medium">{option.label}</span>
                            <span className="block text-[10.5px] leading-4 text-muted">{option.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="rounded-lg border border-[#f2ddb8] bg-warn-soft px-3 py-2 text-[11.5px] leading-5 text-warn">
                    <Info className="mr-1 inline size-3.5" /> Submitting completes the interview and sends the evaluation
                    to interview operations. It cannot be edited afterwards.
                  </div>

                  <button type="submit" className={buttonClasses("primary", "md", "w-full")}>
                    <ClipboardCheck className="size-4" /> Submit evaluation
                  </button>
                </ActionForm>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Evaluation" action={<Clock className="size-4 text-muted" />} />
              <CardBody>
                <p className="text-[13px] leading-6 text-muted">
                  {interview.booking.status === "NO_SHOW"
                    ? "This interview was recorded as a no-show, so no evaluation is required."
                    : interview.status === "RESULT_PUBLISHED"
                      ? "This interview is complete and the result has been published."
                      : "No evaluation can be recorded for this interview in its current state."}
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Record" description="Identifiers used in the audit trail." />
            <CardBody>
              <dl className="space-y-0.5">
                <KeyValue label="Interview ID" value={<span className="font-mono text-[11px]">{interview.id}</span>} />
                <KeyValue label="Booking ID" value={<span className="font-mono text-[11px]">{interview.bookingId}</span>} />
                <KeyValue label="Booking status" value={<StatusPill value={interview.booking.status} />} />
                <KeyValue label="Type" value={interview.interviewType.code} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
