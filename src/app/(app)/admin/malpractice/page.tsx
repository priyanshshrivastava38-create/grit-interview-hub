import Link from "next/link";
import type { ReactNode } from "react";
import { AlertOctagon, ArrowRight, CheckCircle2, Eye, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { requireRole } from "@/lib/auth";
import type { MalpracticeStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { reportMalpracticeAction, updateMalpracticeAction } from "@/app/actions/admin";
import { ActionForm, Modal } from "@/components/action-form";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  InfoBanner,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Integrity cases" };

const fieldClasses =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

const tabs: Array<{ key: string; label: string; statuses?: MalpracticeStatus[] }> = [
  { key: "OPEN", label: "Open", statuses: ["REPORTED", "UNDER_REVIEW"] },
  { key: "CONFIRMED", label: "Confirmed", statuses: ["CONFIRMED"] },
  { key: "CLOSED", label: "Closed", statuses: ["REJECTED", "CLOSED"] },
  { key: "ALL", label: "All cases" },
];

export default async function AdminMalpracticePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const statusKey = tabs.some((tab) => tab.key === params.status) ? (params.status as string) : "OPEN";
  const statuses = tabs.find((tab) => tab.key === statusKey)?.statuses;
  const now = new Date();

  const [cases, students, counts] = await Promise.all([
    prisma.malpracticeCase.findMany({
      where: statuses ? { status: { in: statuses } } : {},
      include: {
        student: { include: { user: true } },
        interview: {
          include: {
            interviewType: true,
            result: true,
            booking: { include: { slot: true } },
            badgeAward: true,
          },
        },
        reportedByUser: { select: { name: true } },
        confirmedByUser: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.studentProfile.findMany({
      include: {
        user: true,
        interviews: {
          include: { interviewType: true, result: true, booking: { include: { slot: true } } },
          orderBy: { createdAt: "desc" },
        },
        badgeAwards: { include: { badge: true }, take: 1 },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.malpracticeCase.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (key: string) => {
    if (key === "ALL") return counts.reduce((sum, row) => sum + row._count._all, 0);
    if (key === "OPEN")
      return counts
        .filter((row) => row.status === "REPORTED" || row.status === "UNDER_REVIEW")
        .reduce((sum, row) => sum + row._count._all, 0);
    if (key === "CLOSED")
      return counts
        .filter((row) => row.status === "REJECTED" || row.status === "CLOSED")
        .reduce((sum, row) => sum + row._count._all, 0);
    return counts.find((row) => row.status === key)?._count._all ?? 0;
  };

  const studentsWithInterviews = students.filter((student) => student.interviews.length > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Integrity cases"
        description="Investigate malpractice allegations and record decisions. Confirmed cases can suspend or nullify a badge without altering the original result."
        actions={
          <Modal
            trigger={
              <>
                <AlertOctagon className="size-3.5" /> Report a case
              </>
            }
            title="Report an integrity concern"
            description="A case is attached to a specific interview. The student is not notified until the case is closed."
            wide
          >
            <ActionForm action={reportMalpracticeAction} successMessage="Integrity case reported" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-medium text-ink-soft" htmlFor="case-interview">
                    Interview
                  </label>
                  <select id="case-interview" name="interviewId" required className={`mt-1.5 ${fieldClasses}`}>
                    <option value="">Choose an interview</option>
                    {studentsWithInterviews.map((student) => (
                      <optgroup key={student.id} label={`${student.user.name} · ${student.studentCode}`}>
                        {student.interviews.map((interview) => (
                          <option key={interview.id} value={interview.id}>
                            {interview.interviewType.code} · {formatDateTime(interview.booking.slot.startsAt)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ink-soft" htmlFor="case-student">
                    Student
                  </label>
                  <select id="case-student" name="studentId" required className={`mt-1.5 ${fieldClasses}`}>
                    <option value="">Choose the student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.user.name} · {student.studentCode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[13px] font-medium text-ink-soft" htmlFor="case-severity">
                  Severity
                </label>
                <select id="case-severity" name="severity" defaultValue="MEDIUM" className={`mt-1.5 ${fieldClasses}`}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-[13px] font-medium text-ink-soft" htmlFor="case-allegation">
                  Allegation
                </label>
                <textarea
                  id="case-allegation"
                  name="allegation"
                  required
                  minLength={20}
                  rows={3}
                  className={`mt-1.5 ${fieldClasses}`}
                  placeholder="Describe what was observed and why it requires review."
                />
              </div>
              <div className="mt-3">
                <label className="block text-[13px] font-medium text-ink-soft" htmlFor="case-evidence">
                  Evidence (optional)
                </label>
                <textarea
                  id="case-evidence"
                  name="evidence"
                  rows={2}
                  className={`mt-1.5 ${fieldClasses}`}
                  placeholder="Links, session notes or interviewer statements."
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className={buttonClasses("danger", "sm")}>
                  Open case
                </button>
              </div>
            </ActionForm>
          </Modal>
        }
      />

      {countFor("OPEN") > 0 ? (
        <div className="mb-4">
          <InfoBanner tone="warn" title={`${countFor("OPEN")} case${countFor("OPEN") === 1 ? "" : "s"} open`}>
            Investigate each case and record a resolution. Suspending or nullifying a badge never changes the published
            interview result, which stays on record for verification.
          </InfoBanner>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/malpractice?status=${tab.key}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              statusKey === tab.key
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
            )}
          >
            {tab.label}
            <span className={cn("rounded-full px-1.5 text-[10.5px] tabular", statusKey === tab.key ? "bg-white/15" : "bg-black/[0.05]")}>
              {countFor(tab.key)}
            </span>
          </Link>
        ))}
      </div>

      {cases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="size-4" />}
            title={statusKey === "OPEN" ? "No open integrity cases" : "No cases in this view"}
            description="Report a concern when an interview needs an integrity review."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((item) => {
            const award = item.interview.badgeAward;
            return (
              <Card key={item.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={item.student.user.name} />
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/students/${item.studentId}`}
                        className="text-[13.5px] font-semibold hover:text-accent"
                      >
                        {item.student.user.name}
                      </Link>
                      <span className="text-[11px] text-muted">{item.student.studentCode}</span>
                      <StatusPill value={item.status} />
                      <Badge tone={item.severity === "HIGH" ? "bad" : item.severity === "LOW" ? "neutral" : "warn"}>
                        {item.severity} severity
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {item.interview.interviewType.name} ·{" "}
                      {formatDateTime(item.interview.booking.slot.startsAt)} · reported{" "}
                      {relativeTime(item.createdAt, now)} by {item.reportedByUser.name}
                    </p>
                    <div className="mt-2 space-y-2">
                      <div className="rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Allegation</p>
                        <p className="mt-0.5 whitespace-pre-line text-[12px] leading-6 text-ink-soft">{item.allegation}</p>
                        {item.evidence ? (
                          <p className="mt-1.5 whitespace-pre-line border-t border-line pt-1.5 text-[11.5px] leading-5 text-muted">
                            Evidence: {item.evidence}
                          </p>
                        ) : null}
                      </div>
                      {item.resolution ? (
                        <div className="rounded-[10px] border border-[#c9e9d3] bg-good-soft px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-good">Resolution</p>
                          <p className="mt-0.5 whitespace-pre-line text-[12px] leading-6 text-ink-soft">{item.resolution}</p>
                          <p className="mt-1 text-[10.5px] text-muted">
                            {item.confirmedByUser?.name ? `Recorded by ${item.confirmedByUser.name}` : ""}
                            {item.confirmedAt ? ` · ${formatDateTime(item.confirmedAt)}` : ""}
                            {item.badgeAction !== "NONE" ? ` · Badge ${item.badgeAction.toLowerCase()}d` : ""}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-[180px] space-y-2 rounded-[10px] border border-line bg-surface p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Interview result</p>
                      <p className="mt-0.5">
                        {item.interview.result ? (
                          <StatusPill value={item.interview.result.outcome} />
                        ) : (
                          <span className="text-[11.5px] text-muted">Not published</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Badge</p>
                      <p className="mt-0.5">
                        {award ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[11.5px] font-medium">Badge on record</span>
                            <StatusPill value={award.status} />
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-muted">No badge on record</span>
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/admin/students/${item.studentId}`}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
                    >
                      Student profile <ArrowRight className="size-3" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {item.status === "REPORTED" ? (
                      <TransitionForm
                        caseId={item.id}
                        label="Start review"
                        icon={<Eye className="size-3.5" />}
                        status="UNDER_REVIEW"
                        title="Move case to review"
                        description="Mark the case as under active investigation."
                        success="Case moved to review"
                      />
                    ) : null}

                    {item.status === "REPORTED" || item.status === "UNDER_REVIEW" ? (
                      <ConfirmForm
                        caseId={item.id}
                        studentHasBadge={Boolean(award)}
                        awardStatus={award?.status ?? null}
                      />
                    ) : null}

                    {item.status === "REPORTED" || item.status === "UNDER_REVIEW" ? (
                      <TransitionForm
                        caseId={item.id}
                        label="Dismiss"
                        icon={<X className="size-3.5" />}
                        status="REJECTED"
                        title="Dismiss integrity case"
                        description="Record that the concern was reviewed and no adverse finding was made. The student is notified."
                        success="Case dismissed"
                        resolution
                      />
                    ) : null}

                    {item.status === "CONFIRMED" || item.status === "REJECTED" ? (
                      <TransitionForm
                        caseId={item.id}
                        label="Close case"
                        icon={<CheckCircle2 className="size-3.5" />}
                        status="CLOSED"
                        title="Close case"
                        description="Closing archives the case. This cannot be undone."
                        success="Case closed"
                      />
                    ) : null}

                    {item.status === "CLOSED" ? <Badge tone="neutral">Archived</Badge> : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted">
        <ShieldAlert className="size-3.5" /> Every status change is transition-checked server-side and written to the audit
        trail with the acting administrator.
      </p>
    </div>
  );
}

function TransitionForm({
  caseId,
  label,
  icon,
  status,
  title,
  description,
  success,
  resolution,
}: {
  caseId: string;
  label: string;
  icon: ReactNode;
  status: "UNDER_REVIEW" | "REJECTED" | "CLOSED";
  title: string;
  description: string;
  success: string;
  resolution?: boolean;
}) {
  return (
    <Modal trigger={<>{icon} {label}</>} title={title} description={description}>
      <ActionForm action={updateMalpracticeAction} successMessage={success}>
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="status" value={status} />
        {resolution ? (
          <>
            <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`resolution-${caseId}-${status}`}>
              Resolution
            </label>
            <textarea
              id={`resolution-${caseId}-${status}`}
              name="resolution"
              required
              minLength={15}
              rows={3}
              className={`mt-1.5 ${fieldClasses}`}
              placeholder="Summarise the investigation and why no adverse finding was made."
            />
          </>
        ) : null}
        <div className="mt-4 flex justify-end">
          <button type="submit" className={buttonClasses("primary", "sm")}>
            {label}
          </button>
        </div>
      </ActionForm>
    </Modal>
  );
}

function ConfirmForm({
  caseId,
  studentHasBadge,
  awardStatus,
}: {
  caseId: string;
  studentHasBadge: boolean;
  awardStatus: string | null;
}) {
  return (
    <Modal
      trigger={
        <>
          <CheckCircle2 className="size-3.5" /> Confirm
        </>
      }
      title="Confirm integrity case"
      description="Document the outcome and decide whether the badge should be suspended or nullified."
    >
      <ActionForm action={updateMalpracticeAction} successMessage="Integrity case confirmed">
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="status" value="CONFIRMED" />
        <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`confirm-${caseId}`}>
          Investigation outcome
        </label>
        <textarea
          id={`confirm-${caseId}`}
          name="resolution"
          required
          minLength={15}
          rows={4}
          className={`mt-1.5 ${fieldClasses}`}
          placeholder="What was found, and why the case is being confirmed."
        />
        <label className="mt-3 block text-[13px] font-medium text-ink-soft" htmlFor={`badge-action-${caseId}`}>
          Badge action
        </label>
        <select
          id={`badge-action-${caseId}`}
          name="badgeAction"
          defaultValue="NONE"
          className={`mt-1.5 ${fieldClasses}`}
        >
          <option value="NONE">No badge change</option>
          {studentHasBadge && awardStatus !== "NULLIFIED" ? (
            <>
              <option value="SUSPEND">Suspend badge</option>
              <option value="NULLIFY">Nullify badge</option>
            </>
          ) : null}
        </select>
        {!studentHasBadge ? (
          <p className="mt-2 text-[11.5px] leading-5 text-muted">
            This student has no awarded badge for this interview type, so only “No badge change” is available.
          </p>
        ) : (
          <p className="mt-2 text-[11.5px] leading-5 text-muted">
            The published result and evaluation stay on record. A badge suspension or nullification is notified to the
            student and audited.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button type="submit" className={buttonClasses("danger", "sm")}>
            Confirm case
          </button>
        </div>
      </ActionForm>
    </Modal>
  );
}
