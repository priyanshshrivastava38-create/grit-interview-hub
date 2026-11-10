import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { requireInterviewer } from "@/lib/auth";
import { getInterviewerDashboard } from "@/lib/analytics";
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
import { formatDate, formatDateTime, formatLongDate, relativeTime, timeInTz, tzAbbreviation } from "@/lib/time";

export const metadata = { title: "Interviewer today" };

export default async function InterviewerOverviewPage() {
  const user = await requireInterviewer();
  const data = await getInterviewerDashboard(user.interviewerId);
  const awaitingPublication = data.awaitingPublication;
  const nextInterview = data.upcoming[0] ?? null;
  const firstName = data.profile.user.name.split(" ")[0];

  const nextAction = (() => {
    if (data.needsEvaluation.length > 0) {
      return {
        title: `${data.needsEvaluation.length} interview${data.needsEvaluation.length === 1 ? "" : "s"} awaiting your evaluation`,
        body: "An evaluation is required before operations can publish a result. Open the interview to record scores and structured feedback.",
        cta: { href: `/interviewer/interviews/${data.needsEvaluation[0].id}`, label: "Submit evaluation" },
        tone: "warn" as const,
      };
    }
    if (nextInterview) {
      return {
        title: `Your next interview is ${relativeTime(nextInterview.booking.slot.startsAt, data.now)}`,
        body: `${nextInterview.student.user.name} · ${nextInterview.interviewType.name} on ${formatDateTime(
          nextInterview.booking.slot.startsAt,
        )} ${tzAbbreviation()}. Review their skill profile before the session.`,
        cta: { href: `/interviewer/interviews/${nextInterview.id}`, label: "Open interview brief" },
        tone: "accent" as const,
      };
    }
    if (data.stats.openSlots === 0) {
      return {
        title: "Publish availability to receive interviews",
        body: "No open slots are published in the next few weeks. Add an availability window so students can book.",
        cta: { href: "/interviewer/availability", label: "Add availability" },
        tone: "info" as const,
      };
    }
    return {
      title: "You are ready for the next booking",
      body: `${data.stats.openSlots} open slot${data.stats.openSlots === 1 ? "" : "s"} are published. Students can book them until the minimum lead time.`,
      cta: { href: "/interviewer/availability", label: "Review availability" },
      tone: "neutral" as const,
    };
  })();

  return (
    <div>
      <PageHeader
        eyebrow={`${data.profile.title} · ${data.profile.specialty}`}
        title={`Today, ${firstName}`}
        description={formatLongDate(data.now)}
        actions={
          <>
            <Link href="/interviewer/availability" className={buttonClasses("outline", "sm")}>
              <Plus className="size-3.5" /> Availability
            </Link>
            <Link href="/interviewer/interviews" className={buttonClasses("primary", "sm")}>
              <CalendarDays className="size-3.5" /> Full schedule
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] border border-[#c4e8df] bg-accent-soft text-accent">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Next action</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{nextAction.title}</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">{nextAction.body}</p>
              <Link href={nextAction.cta.href} className={buttonClasses("primary", "sm", "mt-4")}>
                {nextAction.cta.label} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Your day" description={formatDate(data.now)} action={<CalendarCheck2 className="size-4 text-muted" />} />
          <CardBody>
            {data.todays.length === 0 ? (
              <div className="py-3 text-center">
                <p className="text-[13px] font-medium">No interviews scheduled today</p>
                <p className="mt-1 text-[12px] text-muted">
                  {data.stats.openSlots} open slot{data.stats.openSlots === 1 ? "" : "s"} published for future bookings.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {data.todays.map((interview) => (
                  <li key={interview.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-[52px] shrink-0 text-[12.5px] font-semibold tabular">
                      {timeInTz(interview.booking.slot.startsAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{interview.student.user.name}</p>
                      <p className="truncate text-[11px] text-muted">{interview.interviewType.name}</p>
                    </div>
                    <StatusPill value={interview.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Upcoming interviews"
          value={data.stats.upcomingCount}
          detail={nextInterview ? `Next ${relativeTime(nextInterview.booking.slot.startsAt, data.now)}` : "None booked"}
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Open slots"
          value={data.stats.openSlots}
          detail={`${data.stats.utilization}% utilisation`}
          icon={<ClipboardList className="size-4" />}
        />
        <StatCard
          label="Awaiting publication"
          value={data.stats.pendingEvaluation}
          detail="Evaluation with operations"
          tone={data.stats.pendingEvaluation > 0 ? "warn" : undefined}
          icon={<ClipboardCheck className="size-4" />}
        />
        <StatCard
          label="Completed"
          value={data.stats.completedCount}
          detail={data.stats.avgScore ? `Average score ${data.stats.avgScore}` : "No completed interviews"}
          icon={<Gauge className="size-4" />}
        />
      </div>

      {data.needsEvaluation.length > 0 ? (
        <div className="mt-6">
          <SectionTitle
            title="Evaluation required"
            description="These interviews have taken place and need an evaluation before operations can publish a result."
          />
          <div className="space-y-2">
            {data.needsEvaluation.map((interview) => (
              <Card key={interview.id} className="flex flex-wrap items-center gap-4 p-4">
                <Avatar name={interview.student.user.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{interview.student.user.name}</p>
                  <p className="text-[11.5px] text-muted">
                    {interview.interviewType.name} · {formatDateTime(interview.booking.slot.startsAt)} ·{" "}
                    {interview.student.studentCode}
                  </p>
                </div>
                <StatusPill value={interview.status} />
                <Link
                  href={`/interviewer/interviews/${interview.id}`}
                  className={buttonClasses("primary", "sm")}
                >
                  Evaluate <ArrowRight className="size-3.5" />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Upcoming interviews"
            description="Your next confirmed sessions."
            action={
              <Link href="/interviewer/interviews" className="text-[12px] font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          {data.upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-4" />}
              title="No upcoming interviews"
              description="Once students book your published slots, their interviews appear here."
              action={
                <Link href="/interviewer/availability" className={buttonClasses("outline", "sm")}>
                  Manage availability
                </Link>
              }
            />
          ) : (
            <TableShell className="rounded-none border-0 shadow-none">
              <TableHead>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Student</TableCell>
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">When</TableCell>
                  <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Status</TableCell>
                  <TableCell className="text-right text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Open</TableCell>
                </TableRow>
              </TableHead>
              <tbody>
                {data.upcoming.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      <p className="text-[13px] font-medium">{interview.student.user.name}</p>
                      <p className="text-[11px] text-muted">{interview.interviewType.code}</p>
                    </TableCell>
                    <TableCell className="text-[12.5px]">
                      {formatDateTime(interview.booking.slot.startsAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill value={interview.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/interviewer/interviews/${interview.id}`}
                        className="text-[12px] font-medium text-accent hover:underline"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Wait-list for publication" description="Evaluations with interview operations." />
            <CardBody>
              {awaitingPublication.length === 0 ? (
                <p className="py-2 text-[12.5px] text-muted">
                  No submitted evaluations are waiting on operations.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {awaitingPublication.map((interview) => (
                    <li key={interview.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium">{interview.student.user.name}</p>
                        <p className="text-[11px] text-muted">
                          Submitted {interview.evaluation ? relativeTime(interview.evaluation.submittedAt, data.now) : ""}
                        </p>
                      </div>
                      <Badge tone="warn">Awaiting</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Availability utilisation" />
            <CardBody className="space-y-3">
              <div className="flex items-end justify-between">
                <p className="text-[26px] font-semibold tabular leading-8">{data.stats.utilization}%</p>
                <p className="text-[11.5px] text-muted">
                  {data.stats.bookedSlots} booked / {data.stats.bookedSlots + data.stats.openSlots} upcoming
                </p>
              </div>
              <Progress value={data.stats.utilization} tone="accent" />
              <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> {data.profile.maxDailyInterviews} max per day
                </span>
                <Link href="/interviewer/availability" className="font-medium text-accent hover:underline">
                  Manage
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {data.stats.openSlots > 0 ? (
        <div className="mt-4">
          <InfoBanner tone="neutral" title="Published availability">
            Your next open slots start at {formatDateTime(data.slots.find((slot) => slot.status === "OPEN")?.startsAt ?? data.now)}.
            Students can book up to the standard lead time. Editing or blocking a window with confirmed bookings
            requires operations to reassign those interviews first.
          </InfoBanner>
        </div>
      ) : null}
    </div>
  );
}
