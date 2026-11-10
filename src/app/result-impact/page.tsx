import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, CheckCircle2 } from "lucide-react";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { getStudentDashboard, type StudentDashboardData } from "@/lib/analytics";
import { buildStudentJourney, buildStudentNextAction } from "@/lib/student-journey";
import { JourneyTracker } from "@/components/journey";
import { Badge, buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
import { formatDate, formatLongDate } from "@/lib/time";
import { STUDENT_MESSAGES } from "@/lib/notifications";

export const metadata = { title: "Before and after a result" };
export const dynamic = "force-dynamic";

const PERSONAS = {
  before: "kabir.shah@student.grit.demo",
  passed: "meera.krishnan@student.grit.demo",
  failed: "rohan.verma@student.grit.demo",
} as const;

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-right text-[12.5px] font-medium text-ink">{children}</dd>
    </div>
  );
}

function NextActionCard({ data }: { data: StudentDashboardData }) {
  const action = buildStudentNextAction(data);
  return (
    <Card>
      <CardHeader title="What the student sees" description="The next action on their dashboard." />
      <CardBody>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Next action · {action.eyebrow}</p>
        <p className="mt-1 text-[14px] font-semibold tracking-tight text-ink">{action.title}</p>
        <p className="mt-1 text-[12.5px] leading-5.5 text-ink-soft">{action.body}</p>
      </CardBody>
    </Card>
  );
}

function StudentPanel({
  phase,
  tone,
  data,
}: {
  phase: string;
  tone: "neutral" | "good" | "bad";
  data: StudentDashboardData;
}) {
  const { profile, latestPublished, badge } = data;
  const result = latestPublished?.result ?? null;
  const pending = data.history.find((interview) => interview.status === "RESULT_PENDING");

  return (
    <section className="rounded-card border border-line bg-surface/60 p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-3">
        <div>
          <Badge tone={tone}>{phase}</Badge>
          <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-ink">{profile.user.name}</h2>
          <p className="text-[11.5px] text-muted">
            {profile.studentCode} · {profile.cohort}
          </p>
        </div>
        <Badge tone={tone} dot>
          {result ? result.outcome.replaceAll("_", " ").toLowerCase() : pending ? "awaiting publication" : "in progress"}
        </Badge>
      </div>

      <JourneyTracker title="Clearance path" steps={buildStudentJourney(data)} />

      <div className="mt-3 grid gap-3">
        <NextActionCard data={data} />
        <Card>
          <CardHeader title="Result and badge" description="Read directly from the seeded records." />
          <CardBody className="py-1">
            <dl>
              <DetailRow label="Interview">
                {latestPublished?.booking.slot.startsAt
                  ? formatDate(latestPublished.booking.slot.startsAt)
                  : pending?.booking.slot.startsAt
                    ? formatDate(pending.booking.slot.startsAt)
                    : "Not scheduled"}
              </DetailRow>
              <DetailRow label="Result">
                {result ? result.outcome.replaceAll("_", " ").toLowerCase() : "Awaiting operations"}
              </DetailRow>
              <DetailRow label="Published">
                {result ? formatLongDate(result.publishedAt) : "Not yet published"}
              </DetailRow>
              <DetailRow label="Badge">
                {badge ? (
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="size-3.5 text-accent" />
                    {badge.badge.name} · {badge.status.toLowerCase()}
                  </span>
                ) : (
                  "Not awarded"
                )}
              </DetailRow>
              {result && result.outcome !== "PASS" && latestPublished?.retakeEligibleFrom ? (
                <DetailRow label="Next attempt">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-warn" />
                    Opens {formatDate(latestPublished.retakeEligibleFrom)}
                  </span>
                </DetailRow>
              ) : null}
            </dl>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

export default async function ResultImpactPage() {
  if (!env.demoMode) notFound();

  const profiles = await prisma.studentProfile.findMany({
    where: { user: { email: { in: Object.values(PERSONAS) } } },
    select: { id: true, user: { select: { email: true } } },
  });
  const idFor = (email: string) => profiles.find((profile) => profile.user.email === email)?.id;
  const beforeId = idFor(PERSONAS.before);
  const passedId = idFor(PERSONAS.passed);
  const failedId = idFor(PERSONAS.failed);

  if (!beforeId || !passedId || !failedId) notFound();

  const [before, passed, failed] = await Promise.all([
    getStudentDashboard(beforeId),
    getStudentDashboard(passedId),
    getStudentDashboard(failedId),
  ]);

  return (
    <div className="workspace-bg min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="bg-accent-gradient grid size-9 place-items-center rounded-[11px] text-[15px] font-semibold text-white shadow-[0_4px_14px_-5px_var(--accent-glow)]">
              G
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight">GRIT</span>
              <span className="hidden text-[11px] font-medium text-muted sm:block">Interview Hub</span>
            </span>
          </Link>
          <Link
            href="/"
            className="ml-auto hidden items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-ink sm:inline-flex"
          >
            <ArrowLeft className="size-3.5" /> Back to overview
          </Link>
          <Link href="/login" className={buttonClasses("primary", "sm", "ml-auto sm:ml-0")}>
            Open the demo <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="page-enter max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Before and after</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-ink sm:text-[38px]">
            The same dashboard, before and after a result.
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-muted">
            Three real seeded students, rendered from the database. Kabir has finished his interview and is waiting for
            operations to publish. Meera passed and holds the badge. Rohan did not pass and has a dated retake window.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="page-enter">
            <StudentPanel phase="Before the result" tone="neutral" data={before} />
          </div>
          <div className="page-enter [animation-delay:120ms]">
            <StudentPanel phase="After the result · passed" tone="good" data={passed} />
          </div>
        </div>

        <div className="page-enter mt-4 [animation-delay:200ms]">
          <Card className="overflow-hidden">
            <CardHeader
              title="After the result · not passed"
              description="A fail or retake-later posts a dated next attempt instead of a badge."
              action={<Badge tone="bad">Retake window</Badge>}
            />
            <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_1fr] lg:p-5">
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-ink">{failed.profile.user.name}</p>
                <p className="text-[11.5px] text-muted">
                  {failed.profile.studentCode} · {failed.profile.cohort}
                </p>
                <p className="mt-3 text-[13px] leading-6 text-ink-soft">
                  {buildStudentNextAction(failed).body}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#f2ddb8] bg-warn-soft px-2.5 py-1 text-[11.5px] font-medium text-warn">
                  <CalendarClock className="size-3.5" />
                  {failed.latestPublished?.retakeEligibleFrom
                    ? `Next attempt opens ${formatDate(failed.latestPublished.retakeEligibleFrom)}`
                    : "Eligible to request a retake"}
                </p>
              </div>
              <div className="rounded-[12px] border border-line bg-[#fafaf7] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <CheckCircle2 className="size-3.5 text-accent" /> Exact message sent to a failing student
                </p>
                <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">{STUDENT_MESSAGES.resultFail}</p>
              </div>
            </div>
          </Card>
        </div>

        <p className="mt-6 text-[11.5px] text-muted">
          Read-only comparison of seeded demo records. Sign in to act on your own dashboard.
        </p>
      </main>
    </div>
  );
}
