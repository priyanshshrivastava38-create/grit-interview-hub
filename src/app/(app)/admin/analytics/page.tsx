import Link from "next/link";
import { BarChart3, Clock3, Gauge, TrendingUp, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAdminMetrics } from "@/lib/analytics";
import { BookingVolumeChart, OutcomeDonut, WorkloadChart } from "@/components/charts";
import {
  Badge,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  InfoBanner,
  PageHeader,
  Progress,
  StatCard,
  StatusPill,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics" };

const ranges = [7, 30, 90];

function percent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const requested = Number(params.range);
  const range = ranges.includes(requested) ? requested : 30;
  const data = await getAdminMetrics(range);
  const { kpis, funnel } = data;

  const funnelSteps = [
    { label: "Eligible students", value: funnel.eligible, detail: "Cleared to book" },
    { label: "Booked at least one interview", value: funnel.booked, detail: `${percent(funnel.conversion)} of eligible` },
    { label: "Completed interviews", value: funnel.completed, detail: `${percent(funnel.completionRate)} of booked` },
    { label: "Passed", value: funnel.passed, detail: `${percent(kpis.passRate)} of published` },
  ];
  const maxFunnel = Math.max(...funnelSteps.map((step) => step.value), 1);

  return (
    <div>
      <PageHeader
        eyebrow="Insight"
        title="Analytics"
        description="Operational and outcome metrics computed directly from interview, booking and result records."
        actions={
          <div className="flex items-center gap-1.5">
            {ranges.map((option) => (
              <Link
                key={option}
                href={`/admin/analytics?range=${option}`}
                className={cn(
                  "rounded-[9px] border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  range === option
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
                )}
              >
                {option} days
              </Link>
            ))}
          </div>
        }
      />

      <p className="mb-4 text-[11.5px] text-muted">
        Window {formatDate(new Date(data.generatedAt.getTime() - range * 86_400_000))} – {formatDate(data.generatedAt)} ·
        generated {formatDateTime(data.generatedAt)}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total students"
          value={kpis.totalStudents}
          detail={`${kpis.eligibleStudents} eligible · ${kpis.eligibleUnbooked} unbooked`}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Completed interviews"
          value={kpis.completedInterviews}
          detail={`${kpis.confirmedBookings} currently confirmed`}
          icon={<BarChart3 className="size-4" />}
        />
        <StatCard
          label="Pass rate"
          value={percent(kpis.passRate)}
          detail={`${percent(kpis.retakeRate)} retake outcomes`}
          tone={kpis.passRate !== null && kpis.passRate >= 60 ? "good" : undefined}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="No-show rate"
          value={`${kpis.noShowRate}%`}
          detail={`${data.totalCancellations30d} cancellations, ${data.cancellationGroups} repeat`}
          tone={kpis.noShowRate > 10 ? "warn" : "good"}
          icon={<Clock3 className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Avg. result wait"
          value={kpis.avgResultPublishHours === null ? "—" : `${kpis.avgResultPublishHours}h`}
          detail="Completed → published"
          icon={<Clock3 className="size-4" />}
        />
        <StatCard
          label="Avg. time to interview"
          value={kpis.avgTimeToInterviewDays === null ? "—" : `${kpis.avgTimeToInterviewDays}d`}
          detail="Eligibility → interview"
          icon={<Gauge className="size-4" />}
        />
        <StatCard
          label="Utilisation"
          value={percent(kpis.interviewerUtilization)}
          detail={
            kpis.previousWeekUtilization === null
              ? "Next 14 days"
              : `Previous week ${kpis.previousWeekUtilization}%`
          }
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Open queues"
          value={kpis.pendingResults + kpis.pendingRetakes + kpis.openMalpractice}
          detail={`${kpis.pendingResults} results · ${kpis.pendingRetakes} retakes · ${kpis.openMalpractice} cases`}
          tone={kpis.overdueResults > 0 ? "bad" : undefined}
          icon={<BarChart3 className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Booking volume"
            description={`Bookings created in the last ${range} days.`}
            action={<Badge tone="accent">{range} days</Badge>}
          />
          <CardBody>
            <BookingVolumeChart data={data.charts.bookings} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Outcome distribution" description="Published results in this window." />
          <CardBody>
            <OutcomeDonut data={data.charts.outcomes} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Clearance funnel" description="From eligibility to a published pass." />
          <CardBody className="space-y-4">
            {funnelSteps.map((step, index) => (
              <div key={step.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12.5px] font-medium text-ink">
                    <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step.label}
                  </p>
                  <p className="text-[13px] font-semibold tabular">{step.value}</p>
                </div>
                <Progress
                  value={(step.value / maxFunnel) * 100}
                  className="mt-1.5"
                  tone={index === funnelSteps.length - 1 ? "good" : "accent"}
                />
                <p className="mt-1 text-[10.5px] text-muted">{step.detail}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Interviewer workload" description="Scheduled sessions and pending evaluations." />
          <CardBody>
            {data.charts.workload.length === 0 ? (
              <EmptyState icon={<Users className="size-4" />} title="No interviewer data" />
            ) : (
              <WorkloadChart data={data.charts.workload} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Interviewer utilisation" description="Booked share of published slots in the next 14 days." />
          <CardBody className="p-0">
            {data.charts.workload.length === 0 ? (
              <EmptyState icon={<Users className="size-4" />} title="No interviewers" />
            ) : (
              <ul className="divide-y divide-line">
                {data.charts.workload.map((person) => (
                  <li key={person.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium">{person.name}</p>
                        <p className="text-[10.5px] text-muted">
                          {person.upcoming} upcoming · {person.pending} awaiting publication · max {person.maxDailyInterviews}/day
                        </p>
                      </div>
                      <span className="text-[12.5px] font-semibold tabular">{person.utilization}%</span>
                    </div>
                    <Progress value={person.utilization} className="mt-1.5" tone={person.utilization >= 80 ? "warn" : "accent"} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Operational service levels" description="Where the pipeline needs attention." />
          <CardBody className="space-y-3">
            {[
              {
                label: "Results awaiting publication",
                value: kpis.resultsAwaitingPublication,
                hint: `${kpis.overdueResults} overdue by 24h`,
                href: "/admin/results",
              },
              { label: "Retake requests pending", value: kpis.pendingRetakes, hint: "Awaiting a decision", href: "/admin/retakes" },
              { label: "Integrity cases open", value: kpis.openMalpractice, hint: "Reported or under review", href: "/admin/malpractice" },
              {
                label: "Eligible but unbooked",
                value: kpis.eligibleUnbooked,
                hint: "Students with no confirmed booking",
                href: "/admin/students?status=ELIGIBLE",
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12.5px] font-medium text-ink">{row.label}</p>
                  <p className="text-[10.5px] text-muted">{row.hint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-semibold tabular">{row.value}</span>
                  <Link href={row.href} className={buttonClasses("outline", "sm")}>
                    Open
                  </Link>
                </div>
              </div>
            ))}
            <div className="border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12.5px] font-medium text-ink">Latest published result</p>
                  <p className="text-[10.5px] text-muted">Most recent outcome in the system</p>
                </div>
                {data.charts.outcomes.some((outcome) => outcome.value > 0) ? (
                  <Badge tone="good">
                    {data.charts.outcomes.reduce((best, entry) => (entry.value > best.value ? entry : best), data.charts.outcomes[0]).name}
                  </Badge>
                ) : (
                  <StatusPill value="RESULT_PENDING" />
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {kpis.overdueResults > 0 ? (
        <div className="mt-6">
          <InfoBanner tone="bad" title={`${kpis.overdueResults} result${kpis.overdueResults === 1 ? "" : "s"} outside the 24-hour target`}>
            Publication delays block student next steps. Prioritise the oldest evaluations in the publication queue.
          </InfoBanner>
        </div>
      ) : (
        <div className="mt-6">
          <InfoBanner tone="good" title="Service levels met">
            No evaluation has waited more than 24 hours for publication in this window. Metrics refresh on every page load
            from live records.
          </InfoBanner>
        </div>
      )}
    </div>
  );
}
