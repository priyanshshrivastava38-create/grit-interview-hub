import Link from "next/link";
import { CalendarDays, CalendarPlus, ClipboardCheck, Clock, History } from "lucide-react";
import { requireInterviewer } from "@/lib/auth";
import { getInterviewerDashboard } from "@/lib/analytics";
import {
  Badge,
  buttonClasses,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatusPill,
  TableCell,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata = { title: "Interviewer schedule" };

export default async function InterviewerSchedulePage() {
  const user = await requireInterviewer();
  const data = await getInterviewerDashboard(user.interviewerId);

  const pending = data.awaitingPublication;
  const past = [...data.completed, ...data.needsEvaluation].sort(
    (a, b) => b.booking.slot.startsAt.getTime() - a.booking.slot.startsAt.getTime(),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Interviewer · Schedule"
        title="Your interview schedule"
        description="Confirmed sessions, published outcomes and evaluations awaiting publication."
        actions={
          <>
            <Link href="/interviewer/availability" className={buttonClasses("outline", "sm")}>
              <CalendarPlus className="size-3.5" /> Availability
            </Link>
            <Link href="/interviewer/history" className={buttonClasses("primary", "sm")}>
              <History className="size-3.5" /> Evaluation history
            </Link>
          </>
        }
      />

      <SectionTitle
        title="Upcoming"
        description="Confirmed interviews assigned to you."
        action={<Badge tone="neutral">{data.upcoming.length} scheduled</Badge>}
      />
      {data.upcoming.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-4" />}
            title="No upcoming interviews"
            description="Publish availability so students can book a session with you."
            action={
              <Link href="/interviewer/availability" className={buttonClasses("primary", "sm")}>
                Add availability
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {data.upcoming.map((interview) => (
            <Card key={interview.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="w-[150px] shrink-0 rounded-[10px] border border-line bg-[#fafaf7] px-3 py-2">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                  {formatDate(interview.booking.slot.startsAt)}
                </p>
                <p className="mt-0.5 text-[16px] font-semibold tabular">
                  {interview.booking.slot.startsAt.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: user.timezone,
                  })}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold">{interview.student.user.name}</p>
                  <Badge tone="neutral">{interview.student.studentCode}</Badge>
                  <StatusPill value={interview.status} />
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {interview.interviewType.name} · {interview.student.cohort} · attempt {interview.attemptNumber}
                </p>
              </div>
              <Link href={`/interviewer/interviews/${interview.id}`} className={buttonClasses("primary", "sm")}>
                Open brief
              </Link>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <SectionTitle
          title="Awaiting publication"
          description="Submitted evaluations that interview operations will review and publish."
          action={<Badge tone={pending.length > 0 ? "warn" : "neutral"}>{pending.length} with operations</Badge>}
        />
        {pending.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Clock className="size-4" />}
              title="Nothing waiting on operations"
              description="Submitted evaluations appear here until the result is published."
            />
          </Card>
        ) : (
          <TableShell>
            <TableHead>
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Student</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interviewed</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Recommendation</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Overall</TableCell>
                <TableCell className="text-right text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Status</TableCell>
              </TableRow>
            </TableHead>
            <tbody>
              {pending.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>
                    <p className="text-[13px] font-medium">{interview.student.user.name}</p>
                    <p className="text-[11px] text-muted">{interview.interviewType.name}</p>
                  </TableCell>
                  <TableCell className="text-[12.5px]">{formatDateTime(interview.completedAt ?? interview.booking.slot.startsAt)}</TableCell>
                  <TableCell>
                    <StatusPill value={interview.evaluation?.recommendation ?? "PENDING"} />
                  </TableCell>
                  <TableCell className="text-[12.5px] tabular">{interview.evaluation?.overallScore ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/interviewer/interviews/${interview.id}`}
                      className="text-[12px] font-medium text-accent hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      <div className="mt-8">
        <SectionTitle
          title="Needs your evaluation"
          description="Interviews that took place without a submitted evaluation."
          action={<Badge tone={data.needsEvaluation.length > 0 ? "warn" : "neutral"}>{data.needsEvaluation.length}</Badge>}
        />
        {data.needsEvaluation.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardCheck className="size-4" />}
              title="No outstanding evaluations"
              description="Every interview that has taken place has a submitted evaluation."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {data.needsEvaluation.map((interview) => (
              <Card key={interview.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{interview.student.user.name}</p>
                  <p className="text-[11.5px] text-muted">
                    {interview.interviewType.name} · {formatDateTime(interview.booking.slot.startsAt)}
                  </p>
                </div>
                <Link
                  href={`/interviewer/interviews/${interview.id}`}
                  className={buttonClasses("primary", "sm")}
                >
                  Evaluate
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <SectionTitle
          title="Published interviews"
          description="Completed evaluations whose results have been published."
          action={
            <Link href="/interviewer/history" className="text-[12px] font-medium text-accent hover:underline">
              Full history
            </Link>
          }
        />
        <Card>
          <CardHeader title="Recent outcomes" />
          {past.length === 0 ? (
            <EmptyState
              icon={<History className="size-4" />}
              title="No published outcomes yet"
              description="Results appear here once operations publishes them."
            />
          ) : (
            <ul className="divide-y divide-line">
              {past.slice(0, 6).map((interview) => (
                <li key={interview.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="w-[150px] shrink-0">
                    <p className="text-[12.5px] font-medium">{interview.student.user.name}</p>
                    <p className="text-[11px] text-muted">{formatDate(interview.booking.slot.startsAt)}</p>
                  </div>
                  <div className="min-w-0 flex-1 text-[11.5px] text-muted">
                    {interview.interviewType.name} · overall {interview.evaluation?.overallScore ?? "—"}
                  </div>
                  <StatusPill value={interview.result?.outcome ?? interview.status} />
                  <Link
                    href={`/interviewer/interviews/${interview.id}`}
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
