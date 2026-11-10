import Link from "next/link";
import { CalendarCheck2, CalendarClock, ClipboardCheck, Gauge, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkloadChart } from "@/components/charts";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  StatCard,
} from "@/components/ui";
import { addDays, formatDate, formatDateTime, timeInTz } from "@/lib/time";

export const metadata = { title: "Interviewers" };

export default async function AdminInterviewersPage() {
  await requireRole("ADMIN");
  const now = new Date();
  const horizon = addDays(now, 14);

  const interviewers = await prisma.interviewerProfile.findMany({
    include: {
      user: true,
      slots: {
        where: { startsAt: { gte: now, lte: horizon } },
        select: { status: true, startsAt: true },
        orderBy: { startsAt: "asc" },
      },
      availability: {
        where: { date: { gte: now, lte: horizon } },
        orderBy: { date: "asc" },
      },
      interviews: {
        where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "RESULT_PENDING"] } },
        include: {
          student: { include: { user: true } },
          booking: { include: { slot: true } },
          interviewType: true,
        },
        orderBy: { booking: { slot: { startsAt: "asc" } } },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  const evaluations = await prisma.interviewEvaluation.findMany({
    select: { overallScore: true, interview: { select: { interviewerId: true } } },
  });

  const rows = interviewers.map((interviewer) => {
    const open = interviewer.slots.filter((slot) => slot.status === "OPEN").length;
    const booked = interviewer.slots.filter((slot) => slot.status === "BOOKED").length;
    const total = open + booked;
    const pending = interviewer.interviews.filter((interview) => interview.status === "RESULT_PENDING").length;
    const scores = evaluations
      .filter((evaluation) => evaluation.interview.interviewerId === interviewer.id)
      .map((evaluation) => evaluation.overallScore);
    return {
      ...interviewer,
      open,
      booked,
      utilization: total === 0 ? 0 : Math.round((booked / total) * 100),
      pending,
      avgScore: scores.length === 0 ? null : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      next: interviewer.interviews[0] ?? null,
    };
  });

  const totals = {
    active: interviewers.filter((interviewer) => interviewer.isActive).length,
    upcoming: rows.reduce((sum, row) => sum + row.interviews.length, 0),
    awaiting: rows.reduce((sum, row) => sum + row.pending, 0),
    utilization:
      rows.reduce((sum, row) => sum + row.booked, 0) + rows.reduce((sum, row) => sum + row.open, 0) === 0
        ? 0
        : Math.round(
            (rows.reduce((sum, row) => sum + row.booked, 0) /
              (rows.reduce((sum, row) => sum + row.booked, 0) + rows.reduce((sum, row) => sum + row.open, 0))) *
              100,
          ),
  };

  const workload = rows.map((row) => ({
    name: row.user.name,
    upcoming: row.interviews.filter((interview) => interview.status === "SCHEDULED" || interview.status === "IN_PROGRESS").length,
    pending: row.pending,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Interviewers"
        description="Workload, utilisation and evaluation backlog across the interviewer panel."
        actions={
          <Link href="/admin/analytics" className={buttonClasses("outline", "sm")}>
            <Gauge className="size-3.5" /> Analytics
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active interviewers" value={totals.active} detail={`${interviewers.length} on the panel`} icon={<Users className="size-4" />} />
        <StatCard
          label="Upcoming sessions"
          value={totals.upcoming}
          detail="Next 14 days"
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Evaluations pending"
          value={totals.awaiting}
          detail="Submitted to operations"
          tone={totals.awaiting > 0 ? "warn" : "good"}
          icon={<ClipboardCheck className="size-4" />}
        />
        <StatCard
          label="Panel utilisation"
          value={`${totals.utilization}%`}
          detail="Booked vs open slots"
          icon={<CalendarCheck2 className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Workload" description="Scheduled sessions and evaluations awaiting publication." />
          <CardBody>
            {workload.length === 0 ? (
              <EmptyState icon={<Users className="size-4" />} title="No interviewers on the panel" />
            ) : (
              <WorkloadChart data={workload} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Open capacity" description="Published availability in the next 14 days." />
          <CardBody className="space-y-3.5">
            {rows.map((row) => (
              <div key={row.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={row.user.name} className="size-7 text-[10px]" />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">{row.user.name}</p>
                      <p className="text-[10.5px] text-muted">
                        {row.open} open · {row.booked} booked
                      </p>
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold tabular text-ink">{row.utilization}%</span>
                </div>
                <Progress value={row.utilization} className="mt-1.5" tone={row.utilization >= 80 ? "warn" : "accent"} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar name={row.user.name} />
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold">{row.user.name}</p>
                  {row.isActive ? <Badge tone="good">Active</Badge> : <Badge tone="bad">Inactive</Badge>}
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {row.title} · {row.specialty} · max {row.maxDailyInterviews}/day
                </p>
                <p className="text-[11px] text-muted">{row.user.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Upcoming</p>
                  <p className="font-semibold tabular">{row.interviews.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Awaiting pub.</p>
                  <p className="font-semibold tabular">{row.pending}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Open slots</p>
                  <p className="font-semibold tabular">{row.open}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.06em] text-muted">Avg score</p>
                  <p className="font-semibold tabular">{row.avgScore ?? "—"}</p>
                </div>
              </div>
              <div className="min-w-[200px] rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Next session</p>
                {row.next ? (
                  <>
                    <p className="mt-0.5 text-[12px] font-medium">{row.next.student.user.name}</p>
                    <p className="text-[11px] text-muted">
                      {formatDateTime(row.next.booking.slot.startsAt)} · {row.next.interviewType.code}
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-[11.5px] text-muted">Nothing scheduled</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Badge tone="neutral">{row.availability.length} availability windows</Badge>
              {row.availability.slice(0, 3).map((window) => (
                <Badge key={window.id} tone={window.status === "ACTIVE" ? "good" : "bad"}>
                  {formatDate(window.date)} · {window.startTime}–{window.endTime}
                </Badge>
              ))}
              {row.next ? (
                <span className="ml-auto text-[11.5px] text-muted">
                  Next at {timeInTz(row.next.booking.slot.startsAt)}
                </span>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {interviewers.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={<Users className="size-4" />} title="No interviewers found" />
        </Card>
      ) : null}
    </div>
  );
}
