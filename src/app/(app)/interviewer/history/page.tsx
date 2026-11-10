import Link from "next/link";
import { ClipboardCheck, History, Gauge, TrendingUp } from "lucide-react";
import { requireInterviewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  StatusPill,
  TableCell,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata = { title: "Evaluation history" };

export default async function InterviewerHistoryPage() {
  const user = await requireInterviewer();
  const interviews = await prisma.interview.findMany({
    where: { interviewerId: user.interviewerId, evaluation: { isNot: null } },
    include: {
      student: { include: { user: true } },
      interviewType: true,
      booking: { include: { slot: true } },
      evaluation: true,
      result: true,
    },
    orderBy: { completedAt: "desc" },
  });

  const evaluations = interviews.filter((interview) => interview.evaluation);
  const average =
    evaluations.length === 0
      ? null
      : Math.round(
          evaluations.reduce((sum, interview) => sum + (interview.evaluation?.overallScore ?? 0), 0) /
            evaluations.length,
        );
  const passes = evaluations.filter((interview) => interview.evaluation?.recommendation === "PASS").length;
  const pending = evaluations.filter((interview) => !interview.result).length;

  return (
    <div>
      <PageHeader
        eyebrow="Interviewer · History"
        title="Evaluation history"
        description="Every evaluation you have submitted, with publication status and published outcome."
        actions={
          <Link href="/interviewer/interviews" className={buttonClasses("outline", "sm")}>
            Back to schedule
          </Link>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Evaluations submitted" value={evaluations.length} icon={<ClipboardCheck className="size-4" />} />
        <StatCard
          label="Average overall"
          value={average ?? "—"}
          detail="Across submitted evaluations"
          icon={<Gauge className="size-4" />}
        />
        <StatCard
          label="Pass recommendations"
          value={passes}
          detail={evaluations.length > 0 ? `${Math.round((passes / evaluations.length) * 100)}% of evaluations` : "—"}
          tone={passes > 0 ? "good" : undefined}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Awaiting publication"
          value={pending}
          detail="With interview operations"
          tone={pending > 0 ? "warn" : undefined}
          icon={<History className="size-4" />}
        />
      </div>

      {evaluations.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="size-4" />}
            title="No evaluations submitted yet"
            description="After you evaluate an interview, the scores and recommendation appear here for audit."
            action={
              <Link href="/interviewer/interviews" className={buttonClasses("outline", "sm")}>
                Open schedule
              </Link>
            }
          />
        </Card>
      ) : (
        <TableShell>
          <TableHead>
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Student</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interview</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Scores</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Recommendation</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Publication</TableCell>
              <TableCell className="text-right text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Open</TableCell>
            </TableRow>
          </TableHead>
          <tbody>
            {evaluations.map((interview) => (
              <TableRow key={interview.id}>
                <TableCell>
                  <p className="text-[13px] font-medium">{interview.student.user.name}</p>
                  <p className="text-[11px] text-muted">{interview.student.studentCode}</p>
                </TableCell>
                <TableCell>
                  <p className="text-[12px]">{interview.interviewType.code}</p>
                  <p className="text-[11px] text-muted">{formatDateTime(interview.booking.slot.startsAt)}</p>
                </TableCell>
                <TableCell>
                  <p className="text-[12px] tabular">
                    T {interview.evaluation?.technicalScore} · P {interview.evaluation?.problemSolvingScore} · C{" "}
                    {interview.evaluation?.communicationScore}
                  </p>
                  <p className="text-[11px] text-muted">Overall {interview.evaluation?.overallScore}</p>
                </TableCell>
                <TableCell>
                  <StatusPill value={interview.evaluation?.recommendation ?? "PENDING"} />
                </TableCell>
                <TableCell>
                  {interview.result ? (
                    <div>
                      <StatusPill value={interview.result.outcome} />
                      <p className="mt-1 text-[10.5px] text-muted">
                        {formatDate(interview.result.publishedAt)}
                      </p>
                    </div>
                  ) : (
                    <Badge tone="warn" dot>
                      Awaiting operations
                    </Badge>
                  )}
                </TableCell>
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
  );
}
