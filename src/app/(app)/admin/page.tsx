import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  Gauge,
  History,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAdminMetrics } from "@/lib/analytics";
import { BookingVolumeChart, OutcomeDonut } from "@/components/charts";
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
import { formatDate, formatDateTime, formatLongDate, relativeTime } from "@/lib/time";
import { humanize } from "@/lib/state-machine";

export const metadata = { title: "Command centre" };

function percent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function queueCount(count: number): string {
  return count === 0 ? "Clear" : `${count} waiting`;
}

export default async function AdminOverviewPage() {
  await requireRole("ADMIN");
  const data = await getAdminMetrics(30);
  const { kpis, queue } = data;
  const firstName = data.recentAudit[0]?.actor?.name?.split(" ")[0] ?? "";

  const attention: Array<{
    key: string;
    title: string;
    description: string;
    count: number;
    href: string;
    cta: string;
    icon: typeof Sparkles;
    tone: "warn" | "bad" | "info" | "accent";
  }> = [
    {
      key: "results",
      title: "Results awaiting publication",
      description: "Evaluations that students cannot see until operations publishes the outcome.",
      count: kpis.pendingResults,
      href: "/admin/results",
      cta: "Publish results",
      icon: ClipboardCheck,
      tone: kpis.overdueResults > 0 ? "bad" : "warn",
    },
    {
      key: "retakes",
      title: "Retake requests to review",
      description: "Students waiting on an early-attempt decision.",
      count: kpis.pendingRetakes,
      href: "/admin/retakes",
      cta: "Review requests",
      icon: RotateCcw,
      tone: "warn",
    },
    {
      key: "integrity",
      title: "Open integrity cases",
      description: "Cases that need investigation or a recorded resolution.",
      count: kpis.openMalpractice,
      href: "/admin/malpractice",
      cta: "Open cases",
      icon: ShieldAlert,
      tone: "info",
    },
    {
      key: "unbooked",
      title: "Eligible students without a booking",
      description: "Students cleared for an interview who have not reserved a slot yet.",
      count: kpis.eligibleUnbooked,
      href: "/admin/students?status=ELIGIBLE",
      cta: "View students",
      icon: UserPlus,
      tone: "accent",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Operations · ${formatLongDate(data.generatedAt)}`}
        title="Command centre"
        description="Every interview, result and badge in one operational view. Work the queues below to keep the pipeline moving."
        actions={
          <>
            <Link href="/admin/analytics" className={buttonClasses("outline", "sm")}>
              <BarChart3 className="size-3.5" /> Analytics
            </Link>
            <Link href="/admin/results" className={buttonClasses("primary", "sm")}>
              <ClipboardCheck className="size-3.5" /> Publication queue
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active students"
          value={kpis.totalStudents}
          detail={`${kpis.eligibleStudents} currently eligible`}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Awaiting publication"
          value={kpis.pendingResults}
          detail={kpis.overdueResults > 0 ? `${kpis.overdueResults} overdue by 24h` : "All within service level"}
          tone={kpis.overdueResults > 0 ? "bad" : kpis.pendingResults > 0 ? "warn" : "good"}
          icon={<Clock3 className="size-4" />}
        />
        <StatCard
          label="Pass rate"
          value={percent(kpis.passRate)}
          detail={`${data.charts.outcomes.reduce((sum, entry) => sum + entry.value, 0)} results published`}
          tone={kpis.passRate !== null && kpis.passRate >= 60 ? "good" : undefined}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Interviewer utilisation"
          value={percent(kpis.interviewerUtilization)}
          detail={
            kpis.previousWeekUtilization !== null
              ? `Last week ${kpis.previousWeekUtilization}%`
              : "Next 14 days"
          }
          icon={<Gauge className="size-4" />}
        />
      </div>

      <div className="mt-6">
        <SectionTitle
          title="Needs attention"
          description="Actionable queues across the operations pipeline."
          action={<Badge tone="neutral">Live from the database</Badge>}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.key} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={
                      item.tone === "bad"
                        ? "grid size-9 place-items-center rounded-[10px] border border-[#f5cfcb] bg-bad-soft text-bad"
                        : item.tone === "warn"
                          ? "grid size-9 place-items-center rounded-[10px] border border-[#f2ddb8] bg-warn-soft text-warn"
                          : item.tone === "info"
                            ? "grid size-9 place-items-center rounded-[10px] border border-[#d5dffb] bg-info-soft text-info"
                            : "grid size-9 place-items-center rounded-[10px] border border-[#c4e8df] bg-accent-soft text-accent"
                    }
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="text-[26px] font-semibold tabular leading-8">{item.count}</span>
                </div>
                <p className="mt-3 text-[13px] font-semibold text-ink">{item.title}</p>
                <p className="mt-1 flex-1 text-[11.5px] leading-5 text-muted">{item.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[11px] font-medium text-muted">{queueCount(item.count)}</span>
                  <Link href={item.href} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                    {item.cta} <ArrowRight className="size-3" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Booking volume"
            description={`Confirmed bookings created over the last ${data.rangeDays} days.`}
            action={<Badge tone="accent">30 days</Badge>}
          />
          <CardBody>
            <BookingVolumeChart data={data.charts.bookings} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Outcome mix" description="Published results in this period." />
          <CardBody>
            <OutcomeDonut data={data.charts.outcomes} />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              {data.charts.outcomes.map((outcome) => (
                <div key={outcome.key}>
                  <p className="text-[18px] font-semibold tabular leading-6">{outcome.value}</p>
                  <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted">{outcome.name}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card>
          <CardHeader
            title="Eligible but unbooked"
            description="Cleared students with no confirmed interview."
            action={
              <Link href="/admin/students?status=ELIGIBLE" className="text-[12px] font-medium text-accent hover:underline">
                All students
              </Link>
            }
          />
          <CardBody className="p-0">
            {queue.eligibleUnbooked.length === 0 ? (
              <EmptyState icon={<Users className="size-4" />} title="Everyone eligible has booked" />
            ) : (
              <ul className="divide-y divide-line">
                {queue.eligibleUnbooked.map((student) => (
                  <li key={student.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={student.name} className="size-8 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{student.name}</p>
                      <p className="text-[11px] text-muted">
                        {student.code} · eligible {relativeTime(student.eligibleAt ?? data.generatedAt, data.generatedAt)}
                      </p>
                    </div>
                    <Badge tone={student.daysWaiting > 7 ? "warn" : "neutral"}>{student.daysWaiting}d waiting</Badge>
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="text-[12px] font-medium text-accent hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Reassignment queue"
            description="Bookings whose interviewer or window is no longer available."
            action={
              <Link href="/admin/bookings" className="text-[12px] font-medium text-accent hover:underline">
                Bookings
              </Link>
            }
          />
          <CardBody className="p-0">
            {queue.reassignments.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-4" />} title="No reassignments pending" />
            ) : (
              <ul className="divide-y divide-line">
                {queue.reassignments.map((item) => (
                  <li key={item.interviewId} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12.5px] font-medium">{item.student}</p>
                      <Badge tone="warn">Action needed</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {item.interviewer} · {formatDateTime(item.startsAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Operational health" description="Service levels and funnel conversion." />
          <CardBody className="space-y-3.5">
            {[
              { label: "Result publication wait", value: kpis.avgResultPublishHours === null ? "—" : `${kpis.avgResultPublishHours}h`, hint: "Target under 24h" },
              { label: "No-show rate", value: `${kpis.noShowRate}%`, hint: "Last 30 days" },
              { label: "Eligibility conversion", value: percent(kpis.eligibilityConversion), hint: "Eligible → booked" },
              { label: "Average time to interview", value: kpis.avgTimeToInterviewDays === null ? "—" : `${kpis.avgTimeToInterviewDays}d`, hint: "From eligibility" },
              { label: "Overdue results", value: kpis.overdueResults, hint: "Evaluated 24h+ ago" },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12px] text-muted">{metric.label}</p>
                  <p className="text-[13px] font-semibold tabular text-ink">{metric.value}</p>
                </div>
                <p className="text-[10.5px] text-zinc-400">{metric.hint}</p>
              </div>
            ))}
            <div className="border-t border-line pt-3">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">Interviewer workload</span>
                <Link href="/admin/interviewers" className="font-medium text-accent hover:underline">
                  Review
                </Link>
              </div>
              <div className="mt-2 space-y-2">
                {data.charts.workload.slice(0, 3).map((person) => (
                  <div key={person.id}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="truncate text-ink-soft">{person.name}</span>
                      <span className="tabular text-muted">{person.utilization}%</span>
                    </div>
                    <Progress value={person.utilization} className="mt-1" tone={person.utilization >= 80 ? "warn" : "accent"} />
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Upcoming interviews"
            description="Confirmed sessions across every interviewer."
            action={
              <Link href="/admin/bookings" className="text-[12px] font-medium text-accent hover:underline">
                Manage
              </Link>
            }
          />
          {data.upcomingInterviews.length === 0 ? (
            <EmptyState icon={<CalendarClock className="size-4" />} title="No upcoming interviews" />
          ) : (
            <TableShell className="rounded-none border-0 shadow-none">
              <TableHead>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Student</TableCell>
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interviewer</TableCell>
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">When</TableCell>
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Status</TableCell>
                </TableRow>
              </TableHead>
              <tbody>
                {data.upcomingInterviews.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      <p className="text-[13px] font-medium">{interview.student}</p>
                      <p className="text-[11px] text-muted">{interview.type}</p>
                    </TableCell>
                    <TableCell className="text-[12.5px]">{interview.interviewer}</TableCell>
                    <TableCell className="text-[12.5px]">{formatDateTime(interview.startsAt)}</TableCell>
                    <TableCell>
                      <StatusPill value={interview.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent audit events"
            description="Every sensitive action is recorded."
            action={
              <Link href="/admin/audit" className="text-[12px] font-medium text-accent hover:underline">
                Audit trail
              </Link>
            }
          />
          <CardBody className="p-0">
            {data.recentAudit.length === 0 ? (
              <EmptyState icon={<History className="size-4" />} title="No audit events yet" />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentAudit.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-ink">{humanize(entry.action.replaceAll(".", " "))}</p>
                      <span className="shrink-0 text-[10.5px] text-zinc-400">{relativeTime(entry.createdAt, data.generatedAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">{entry.summary}</p>
                    <p className="text-[10.5px] text-zinc-400">{entry.actor?.name ?? "System"}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {kpis.overdueResults > 0 ? (
        <div className="mt-6">
          <InfoBanner
            tone="bad"
            title={`${kpis.overdueResults} result${kpis.overdueResults === 1 ? "" : "s"} overdue for publication`}
            action={
              <Link href="/admin/results" className={buttonClasses("danger", "sm")}>
                Publish now
              </Link>
            }
          >
            Evaluations completed more than 24 hours ago are still hidden from students. Review the feedback and publish
            an outcome so the student can act on their result.
          </InfoBanner>
        </div>
      ) : (
        <div className="mt-6">
          <InfoBanner tone="good" title="Publication service level met">
            All submitted evaluations are within the 24-hour publication target as of {formatDate(data.generatedAt)}.
            {firstName ? ` Last activity recorded by ${firstName}.` : ""}
          </InfoBanner>
        </div>
      )}
    </div>
  );
}
