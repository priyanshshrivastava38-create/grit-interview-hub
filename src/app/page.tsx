import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getSessionUser, homeForRole } from "@/lib/auth";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";

const valueProps = [
  {
    title: "One clearance lifecycle",
    description:
      "Eligibility, booking, interview state, outcome, badge and retake each have their own explicit state — never one overloaded status field.",
    icon: <Sparkles className="size-4" />,
  },
  {
    title: "Bookings that hold up",
    description:
      "Row-locked transactions, unique active-booking indexes and server-side revalidation stop two students winning the same slot.",
    icon: <LockKeyhole className="size-4" />,
  },
  {
    title: "Evaluation with evidence",
    description:
      "Structured scoring, strengths, improvement areas and a recommendation that operations can review before publication.",
    icon: <ClipboardCheck className="size-4" />,
  },
  {
    title: "Operational visibility",
    description:
      "Action queues surface unbooked eligible students, overdue results, blocked availability and integrity cases before they become incidents.",
    icon: <CalendarCheck2 className="size-4" />,
  },
  {
    title: "History that is never rewritten",
    description:
      "Reschedules, cancellations, badge suspensions and malpractice decisions preserve the original booking, result and audit trail.",
    icon: <RotateCcw className="size-4" />,
  },
  {
    title: "Three focused experiences",
    description:
      "Students always know the next action. Interviewers see the day and the evaluation. Operations sees the whole system.",
    icon: <Users className="size-4" />,
  },
];

const workflow = [
  ["Eligibility", "Skill milestones complete; the system unlocks interview eligibility and tells the student exactly why."],
  ["Booking", "Available slots are filtered by policy and reserved atomically, with a friendly conflict if someone wins the race."],
  ["Interview", "The interviewer sees the student, the brief and the schedule, then starts and completes the interview."],
  ["Evaluation", "Scores and structured feedback are submitted once, with an audit entry and a recommendation."],
  ["Publication", "Operations reviews the recommendation and publishes the result with a feedback summary."],
  ["Badge or retake", "A pass awards the badge automatically. Fail and retake-later publish the next eligible attempt date."],
  ["Integrity", "Allegations are investigations, not verdicts. Confirmed cases adjust the badge while preserving history."],
];

const roles = [
  {
    key: "STUDENT",
    label: "Student",
    href: "/login?role=student",
    description: "Eligibility, slot booking, interview details, results, badges and retakes.",
    points: ["Guided next action", "Cancel or reschedule within policy", "Exact result notifications"],
    icon: <Award className="size-5" />,
  },
  {
    key: "INTERVIEWER",
    label: "Interviewer",
    href: "/login?role=interviewer",
    description: "Daily schedule, availability, student context and structured evaluations.",
    points: ["Break-aware availability", "Assigned interviews only", "Evaluation history"],
    icon: <ClipboardCheck className="size-5" />,
  },
  {
    key: "ADMIN",
    label: "Interview operations",
    href: "/login?role=admin",
    description: "Operational queues, result publication, retakes, integrity and analytics.",
    points: ["Reassignment queue", "Real database analytics", "Full audit trail"],
    icon: <ShieldCheck className="size-5" />,
  },
];

const queuePreview = [
  { label: "Result awaiting publication", detail: "Kabir Shah · evaluated 2 days ago", tone: "warn" as const },
  { label: "Reassignment required", detail: "Ishita Rao · interviewer availability blocked", tone: "bad" as const },
  { label: "Retake review", detail: "Rohan Verma · waiting period appeal", tone: "info" as const },
  { label: "Integrity case under review", detail: "Sara Khan · result preserved", tone: "violet" as const },
];

const toneDot: Record<string, string> = {
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  violet: "bg-violet",
};

export default async function LandingPage() {
  const session = await getSessionUser();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="bg-accent-gradient grid size-9 place-items-center rounded-[11px] text-[15px] font-semibold text-white shadow-[0_4px_14px_-5px_var(--accent-glow)]">
              G
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight">GRIT</span>
              <span className="block text-[11px] font-medium text-muted">Interview Hub</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-[13px] font-medium text-ink-soft md:flex">
            <a href="#product" className="hover:text-ink">
              Product
            </a>
            <a href="#workflow" className="hover:text-ink">
              Workflow
            </a>
            <a href="#roles" className="hover:text-ink">
              Roles
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {session ? (
              <Link href={homeForRole(session.role)} className={buttonClasses("primary", "sm")}>
                Open workspace <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <Link href="/login" className={buttonClasses("primary", "sm")}>
                Explore the live demo <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="animate-drift absolute -left-28 -top-40 size-[440px] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.18),transparent_66%)]" />
            <div className="animate-drift absolute -right-24 top-4 size-[380px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.16),transparent_66%)] [animation-delay:-7s]" />
            <div className="absolute inset-0 grid-lines opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
          </div>
          <div className="page-enter relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-ink-soft shadow-card">
                <span className="bg-accent-gradient size-1.5 rounded-full" />
                Interview operations, evaluation &amp; badge clearance
              </p>
              <h1 className="mt-5 max-w-2xl text-balance text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[52px]">
                Every interview. Every result. Every badge.{" "}
                <span className="text-gradient">Accounted for.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
                GRIT Interview Hub runs the full journey from skill completion to badge clearance. Students book
                with confidence, interviewers evaluate with structure, and operations resolves the exceptions that
                real programmes produce.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/login" className={buttonClasses("primary", "lg")}>
                  <CalendarPlus className="size-4" /> Enter the demo
                </Link>
                <a href="#product" className={buttonClasses("outline", "lg")}>
                  See the product
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-muted">
                {["Working booking concurrency", "Role-based access control", "Seeded, explorable scenarios"].map(
                  (item) => (
                    <span key={item} className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-accent" /> {item}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-4 rounded-[30px] bg-gradient-to-br from-[rgba(15,118,110,0.10)] via-white/40 to-[rgba(99,102,241,0.10)] blur-[2px]"
              />
              <div className="card-gradient-border relative rounded-[20px] p-4 shadow-pop sm:p-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Command centre
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold tracking-tight">Needs attention</p>
                  </div>
                  <span className="rounded-full border border-[#c4e8df] bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-ink">
                    4 open queues
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {queuePreview.map((item) => (
                    <li key={item.label} className="flex items-start gap-3 py-3">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[item.tone])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">{item.label}</p>
                        <p className="text-[11.5px] text-muted">{item.detail}</p>
                      </div>
                      <ArrowRight className="mt-1 size-3.5 text-zinc-300" />
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex items-center justify-between rounded-[12px] border border-line bg-[#fafaf7] px-3 py-2.5">
                  <div>
                    <p className="text-[11px] text-muted">Clearance funnel</p>
                    <p className="text-[12.5px] font-medium">Eligible → booked → evaluated → badged</p>
                  </div>
                  <ShieldCheck className="size-4 text-accent" />
                </div>
                <p className="mt-3 text-[10.5px] text-zinc-400">
                  Illustrative preview of the seeded demo scenarios.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">The product</p>
              <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-[34px]">
                Built for the exceptions, not just the happy path.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-muted">
                Most interview tools stop at scheduling. GRIT has to answer harder questions: what happens when an
                interviewer withdraws availability, when a result sits unpublished, when a student appeals a retake
                window, or when an integrity concern needs an investigation rather than an accusation. Those cases are
                modelled explicitly here.
              </p>
            </div>
            <div className="stagger-grid mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {valueProps.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-card border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-pop"
                >
                  <span className="grid size-8 place-items-center rounded-[9px] border border-line bg-canvas text-accent transition-transform group-hover:scale-110">
                    {item.icon}
                  </span>
                  <h3 className="mt-4 text-[14px] font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-muted">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Workflow</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[34px]">
                  One lifecycle, seven accountable steps.
                </h2>
              </div>
              <p className="max-w-sm text-[13px] leading-6 text-muted">
                Each step has an owner, a validated transition and a notification. Nothing moves silently.
              </p>
            </div>
            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {workflow.map(([title, description], index) => (
                <div key={title} className="border-t border-line pt-4">
                  <p className="text-[11px] font-semibold tabular text-accent">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-[14px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-5.5 text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="border-t border-line bg-[#f0efeb]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Three roles</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[34px]">
                A focused workspace for every person in the process.
              </h2>
            </div>
            <div className="stagger-grid mt-10 grid gap-4 lg:grid-cols-3">
              {roles.map((role) => (
                <Link
                  key={role.label}
                  href={role.href}
                  data-role={role.key}
                  className="group relative isolate flex flex-col overflow-hidden rounded-card border border-line bg-surface p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
                >
                  <span
                    aria-hidden
                    className="bg-accent-gradient absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <span className="grid size-10 place-items-center rounded-[11px] bg-accent-soft text-accent-ink transition-transform duration-200 group-hover:scale-105">
                    {role.icon}
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{role.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-muted">{role.description}</p>
                  <ul className="mt-4 space-y-1.5">
                    {role.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                        <CheckCircle2 className="size-3.5 text-accent" /> {point}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
                    Enter as {role.label.toLowerCase()}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div>
              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                A demo that behaves like a product, not a prototype.
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-7 text-muted">
                Every scenario is real database state you can act on: book the last slot, publish a result, block
                availability, approve a retake or resolve an integrity case. Reset the demo from the admin console to
                start again.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/login" className={buttonClasses("primary", "lg")}>
                Open demo access <ArrowRight className="size-4" />
              </Link>
              <a href="#product" className={buttonClasses("outline", "lg")}>
                Read the product story
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[12px] text-muted sm:px-6">
          <p className="flex items-center gap-2">
            <span className="bg-accent-gradient grid size-6 place-items-center rounded-md text-[10px] font-semibold text-white">
              G
            </span>
            GRIT Interview Hub · Interview scheduling, evaluation &amp; badge clearance
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-ink">
              Demo access
            </Link>
            <span className="text-zinc-300">·</span>
            <span>Demo environment · seeded data</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
