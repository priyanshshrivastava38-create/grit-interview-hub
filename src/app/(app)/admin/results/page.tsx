import Link from "next/link";
import { ArrowRight, ClipboardCheck, Clock3, FileCheck2, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import type { InterviewStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { publishResultAction } from "@/app/actions/admin";
import { ActionForm, Modal } from "@/components/action-form";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  InfoBanner,
  PageHeader,
  Progress,
  StatusPill,
} from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Result publication" };

const fieldClasses =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular text-ink">{value}</span>
      </div>
      <Progress value={value} className="mt-1" tone={value >= 70 ? "good" : "warn"} />
    </div>
  );
}

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status = params.status === "published" ? "published" : "pending";
  const query = (params.q ?? "").trim();
  const now = new Date();

  const interviews = await prisma.interview.findMany({
    where: {
      status: (status === "pending" ? "RESULT_PENDING" : "RESULT_PUBLISHED") as InterviewStatus,
      ...(query
        ? {
            student: {
              OR: [
                { studentCode: { contains: query, mode: "insensitive" } },
                { user: { name: { contains: query, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    },
    include: {
      evaluation: { include: { submittedByUser: { select: { name: true } } } },
      result: { include: { publishedByUser: { select: { name: true } } } },
      student: { include: { user: true } },
      interviewType: true,
      interviewer: { include: { user: true } },
      booking: { include: { slot: true } },
    },
    orderBy: status === "pending" ? { completedAt: "asc" } : { resultPublishedAt: "desc" },
    take: 100,
  });

  const overdue = interviews.filter(
    (interview) =>
      interview.status === "RESULT_PENDING" &&
      interview.completedAt &&
      now.getTime() - interview.completedAt.getTime() > 24 * 3_600_000,
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Result publication"
        description="Review submitted evaluations and publish the student-facing outcome. Publishing triggers the result notification and badge clearance."
        actions={
          <Link href="/admin/retakes" className={buttonClasses("outline", "sm")}>
            Retake queue
          </Link>
        }
      />

      {status === "pending" && overdue > 0 ? (
        <div className="mb-4">
          <InfoBanner tone="bad" title={`${overdue} result${overdue === 1 ? "" : "s"} overdue`}>
            These evaluations were completed more than 24 hours ago. Students cannot act on their outcome until the result
            is published.
          </InfoBanner>
        </div>
      ) : null}

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/results">
        <input type="hidden" name="status" value={status} />
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search student name or code"
            className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            aria-label="Search results"
          />
        </div>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Search
        </button>
        {query ? (
          <Link href={`/admin/results?status=${status}`} className={buttonClasses("ghost", "md")}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mb-5 flex gap-1.5">
        {[
          { key: "pending", label: "Awaiting publication" },
          { key: "published", label: "Published" },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/results?status=${tab.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              status === tab.key
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {interviews.length === 0 ? (
        <Card>
          <EmptyState
            icon={status === "pending" ? <Clock3 className="size-4" /> : <FileCheck2 className="size-4" />}
            title={status === "pending" ? "Publication queue is clear" : "No published results yet"}
            description={
              status === "pending"
                ? "Submitted evaluations appear here. Interviewers must submit an evaluation before a result can be published."
                : "Published outcomes will be listed here with their feedback summary."
            }
            action={
              status === "pending" ? (
                <Link href="/admin/interviewers" className={buttonClasses("outline", "sm")}>
                  Review interviewer workload
                </Link>
              ) : null
            }
          />
        </Card>
      ) : status === "pending" ? (
        <div className="space-y-3">
          {interviews.map((interview) => {
            const evaluation = interview.evaluation;
            const completedAgo = interview.completedAt ? relativeTime(interview.completedAt, now) : "recently";
            const isOverdue =
              interview.completedAt !== null && now.getTime() - interview.completedAt.getTime() > 24 * 3_600_000;
            return (
              <Card key={interview.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={interview.student.user.name} />
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/students/${interview.studentId}`}
                        className="text-[13.5px] font-semibold hover:text-accent"
                      >
                        {interview.student.user.name}
                      </Link>
                      <span className="text-[11px] text-muted">{interview.student.studentCode}</span>
                      <Badge tone={isOverdue ? "bad" : "warn"}>{isOverdue ? "Overdue" : "Awaiting publication"}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {interview.interviewType.name} · attempt {interview.attemptNumber} · {formatDateTime(interview.booking.slot.startsAt)} ·{" "}
                      {interview.interviewer.user.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">Completed {completedAgo}</p>
                    {evaluation ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <ScoreBar label="Technical" value={evaluation.technicalScore} />
                        <ScoreBar label="Problem solving" value={evaluation.problemSolvingScore} />
                        <ScoreBar label="Communication" value={evaluation.communicationScore} />
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-[220px] rounded-[10px] border border-line bg-[#fafaf7] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Recommendation</p>
                    <div className="mt-1">
                      {evaluation ? <StatusPill value={evaluation.recommendation} /> : <Badge tone="neutral">No evaluation</Badge>}
                    </div>
                    {evaluation ? (
                      <>
                        <p className="mt-2 text-[11px] text-muted">
                          Overall score <span className="font-semibold tabular text-ink">{evaluation.overallScore}</span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-soft">{evaluation.improvements}</p>
                      </>
                    ) : null}
                  </div>

                  <Modal
                    trigger={
                      <>
                        <ClipboardCheck className="size-3.5" /> Publish
                      </>
                    }
                    title="Publish interview result"
                    description="The interviewer's overall score and recommendation are published to the student exactly as recorded. Add a short feedback summary."
                    wide
                  >
                    {evaluation ? (
                      <ActionForm action={publishResultAction} successMessage="Result published">
                        <input type="hidden" name="interviewId" value={interview.id} />
                        <div className="mb-4 rounded-[10px] border border-line bg-[#fafaf7] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[12.5px] font-medium">
                              {interview.student.user.name} · {interview.interviewType.name}
                            </p>
                            <StatusPill value={evaluation.recommendation} />
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Strengths</p>
                              <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-5 text-ink-soft">{evaluation.strengths}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Improvements</p>
                              <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-5 text-ink-soft">{evaluation.improvements}</p>
                            </div>
                          </div>
                        </div>
                        <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`feedback-${interview.id}`}>
                          Student-facing feedback summary
                        </label>
                        <textarea
                          id={`feedback-${interview.id}`}
                          name="feedbackSummary"
                          required
                          minLength={10}
                          rows={4}
                          className={`mt-1.5 ${fieldClasses}`}
                          placeholder="Summarise the outcome in language the student can act on."
                        />
                        <p className="mt-2 text-[11.5px] leading-5 text-muted">
                          Publishing sends the result notification immediately
                          {evaluation.recommendation === "PASS"
                            ? " and awards the GRIT badge automatically."
                            : " and opens the retake waiting period."}
                        </p>
                        <div className="mt-4 flex justify-end">
                          <button type="submit" className={buttonClasses("primary", "sm")}>
                            Publish {evaluation.recommendation.replaceAll("_", " ").toLowerCase()}
                          </button>
                        </div>
                      </ActionForm>
                    ) : (
                      <p className="text-[13px] text-muted">
                        The interviewer has not submitted an evaluation. A result cannot be published until they do.
                      </p>
                    )}
                  </Modal>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
            <Card key={interview.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={interview.student.user.name} />
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/students/${interview.studentId}`}
                      className="text-[13.5px] font-semibold hover:text-accent"
                    >
                      {interview.student.user.name}
                    </Link>
                    <StatusPill value={interview.result?.outcome ?? "RESULT_PUBLISHED"} />
                    {interview.result?.outcome === "PASS" ? <Badge tone="good">Badge awarded</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {interview.interviewType.name} · attempt {interview.attemptNumber} ·{" "}
                    {formatDateTime(interview.booking.slot.startsAt)} · {interview.interviewer.user.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Published{" "}
                    {interview.resultPublishedAt ? formatDateTime(interview.resultPublishedAt) : "—"} by{" "}
                    {interview.result?.publishedByUser.name ?? "operations"}
                  </p>
                  {interview.result ? (
                    <p className="mt-2 max-w-xl text-[12px] leading-6 text-ink-soft">{interview.result.feedbackSummary}</p>
                  ) : null}
                </div>
                <div className="min-w-[140px] rounded-[10px] border border-line bg-[#fafaf7] p-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Overall score</p>
                  <p className="mt-0.5 text-[22px] font-semibold tabular leading-7">{interview.result?.overallScore ?? "—"}</p>
                  <Link
                    href={`/admin/students/${interview.studentId}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
                  >
                    Profile <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
