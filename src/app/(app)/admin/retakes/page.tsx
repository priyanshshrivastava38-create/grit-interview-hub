import Link from "next/link";
import { Check, RotateCcw, X } from "lucide-react";
import { requireRole } from "@/lib/auth";
import type { RetakeStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { reviewRetakeAction } from "@/app/actions/admin";
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
import { formatDate, formatDateTime, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Retake requests" };

const fieldClasses =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

const tabs: Array<{ key: string; label: string; status?: RetakeStatus }> = [
  { key: "PENDING", label: "Pending", status: "PENDING" },
  { key: "APPROVED", label: "Approved", status: "APPROVED" },
  { key: "SCHEDULED", label: "Scheduled", status: "SCHEDULED" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
  { key: "ALL", label: "All requests" },
];

export default async function AdminRetakesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const statusKey = tabs.some((tab) => tab.key === params.status) ? (params.status as string) : "PENDING";
  const status = tabs.find((tab) => tab.key === statusKey)?.status;
  const now = new Date();

  const requests = await prisma.retakeRequest.findMany({
    where: status ? { status } : {},
    include: {
      student: { include: { user: true } },
      interviewType: true,
      interview: { include: { result: true, booking: { include: { slot: true } } } },
      reviewedByUser: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 100,
  });

  const counts = await prisma.retakeRequest.groupBy({ by: ["status"], _count: { _all: true } });
  const countFor = (key: string) =>
    key === "ALL"
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === key)?._count._all ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Retake requests"
        description="Review requests to attempt an interview before the standard waiting period ends."
        actions={
          <Link href="/admin/results" className={buttonClasses("outline", "sm")}>
            Result publication
          </Link>
        }
      />

      {countFor("PENDING") > 0 ? (
        <div className="mb-4">
          <InfoBanner tone="warn" title={`${countFor("PENDING")} request${countFor("PENDING") === 1 ? "" : "s"} awaiting a decision`}>
            Approving a request lets the student book immediately, ahead of their scheduled retake date. Rejecting keeps the
            original waiting period and requires a note.
          </InfoBanner>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/retakes?status=${tab.key}`}
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

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RotateCcw className="size-4" />}
            title={statusKey === "PENDING" ? "No retake requests pending" : "No requests in this view"}
            description="Students can request an earlier attempt from their interview details after a published FAIL or RETAKE_LATER result."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const student = request.student.user;
            return (
              <Card key={request.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={student.name} />
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/students/${request.studentId}`}
                        className="text-[13.5px] font-semibold hover:text-accent"
                      >
                        {student.name}
                      </Link>
                      <span className="text-[11px] text-muted">{request.student.studentCode}</span>
                      <StatusPill value={request.status} />
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {request.interviewType.name} · requested {relativeTime(request.createdAt, now)}
                      {request.interview?.result ? ` · previous outcome ${request.interview.result.outcome.replaceAll("_", " ").toLowerCase()}` : ""}
                    </p>
                    <div className="mt-2 rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Student reason</p>
                      <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">{request.reason}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted">
                      <span>
                        Standard eligibility <span className="font-medium text-ink-soft">{formatDate(request.eligibleFrom)}</span>
                      </span>
                      {request.interview ? (
                        <span>
                          Last interview{" "}
                          <span className="font-medium text-ink-soft">{formatDateTime(request.interview.booking.slot.startsAt)}</span>
                        </span>
                      ) : null}
                      {request.reviewedAt ? (
                        <span>
                          Reviewed {formatDate(request.reviewedAt)} by {request.reviewedByUser?.name ?? "operations"}
                        </span>
                      ) : null}
                    </div>
                    {request.decisionNote ? (
                      <p className="mt-1.5 text-[11.5px] text-muted">Decision note: {request.decisionNote}</p>
                    ) : null}
                  </div>

                  {request.status === "PENDING" ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Modal
                        trigger={
                          <>
                            <Check className="size-3.5" /> Approve
                          </>
                        }
                        title="Approve early retake"
                        description="The student will be able to book immediately, ahead of the standard waiting period."
                      >
                        <ActionForm action={reviewRetakeAction} successMessage="Retake approved">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="APPROVED" />
                          <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`approve-${request.id}`}>
                            Decision note
                          </label>
                          <textarea
                            id={`approve-${request.id}`}
                            name="note"
                            required
                            minLength={5}
                            rows={3}
                            className={`mt-1.5 ${fieldClasses}`}
                            placeholder="Shared with the student in their retake notification."
                            defaultValue={`Approved early retake for ${request.interviewType.name}.`}
                          />
                          <div className="mt-4 flex justify-end">
                            <button type="submit" className={buttonClasses("primary", "sm")}>
                              Approve retake
                            </button>
                          </div>
                        </ActionForm>
                      </Modal>

                      <Modal
                        trigger={
                          <>
                            <X className="size-3.5" /> Decline
                          </>
                        }
                        title="Decline retake request"
                        description="The original waiting period stays in place. The student is notified with your note."
                      >
                        <ActionForm action={reviewRetakeAction} successMessage="Retake request declined">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`reject-${request.id}`}>
                            Decision note
                          </label>
                          <textarea
                            id={`reject-${request.id}`}
                            name="note"
                            required
                            minLength={5}
                            rows={3}
                            className={`mt-1.5 ${fieldClasses}`}
                            placeholder="Explain the decision. The student sees this note."
                          />
                          <div className="mt-4 flex justify-end">
                            <button type="submit" className={buttonClasses("danger", "sm")}>
                              Decline request
                            </button>
                          </div>
                        </ActionForm>
                      </Modal>
                    </div>
                  ) : (
                    <Badge tone="neutral">
                      {request.status === "SCHEDULED" ? "Already booked" : request.status === "COMPLETED" ? "Completed" : "Decision recorded"}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
