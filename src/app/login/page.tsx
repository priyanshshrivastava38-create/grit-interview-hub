import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { DemoLogin, type DemoPersona } from "./demo-login";
import { getSessionUser, homeForRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const SCENARIOS: Record<string, string> = {
  "aarav.mehta@student.grit.demo": "Eligible, not booked",
  "ishita.rao@student.grit.demo": "Interview tomorrow · reassignment needed",
  "kabir.shah@student.grit.demo": "Result awaiting publication",
  "meera.krishnan@student.grit.demo": "Passed · badge awarded",
  "rohan.verma@student.grit.demo": "Failed · retake request pending",
  "ananya.iyer@student.grit.demo": "Cancelled booking",
  "dev.malhotra@student.grit.demo": "Not eligible · 2 of 5 skills",
  "sara.khan@student.grit.demo": "Badge awarded · case under review",
  "nikhil.joshi@student.grit.demo": "No-show recorded",
  "priya.nair@student.grit.demo": "Rescheduled interview",
  "arjun.desai@student.grit.demo": "Badge nullified · confirmed case",
  "tanya.bose@student.grit.demo": "Eligible for 9 days · unbooked",
  "aisha.siddiqui@student.grit.demo": "Eligibility revoked",
  "varun.pillai@student.grit.demo": "Retake approved · ready to book",
  "riya.sen@student.grit.demo": "Interview tomorrow · full day",
  "manav.gupta@student.grit.demo": "Interview tomorrow · full day",
  "sneha.pillai@student.grit.demo": "Interview tomorrow · full day",
  "neel.bhatt@student.grit.demo": "Retake later · waiting period",
  "vikram.sethi@grit.demo": "Open slots and evaluation history",
  "neha.kapoor@grit.demo": "Reviewing a blocked availability day",
  "aditya.menon@grit.demo": "Fully booked tomorrow",
  "fatima.sheikh@grit.demo": "Blocked window with bookings",
  "priyanka.raman@grit.demo": "Full operations access",
};

const ORDER = [
  "aarav.mehta@student.grit.demo",
  "ishita.rao@student.grit.demo",
  "kabir.shah@student.grit.demo",
  "meera.krishnan@student.grit.demo",
  "rohan.verma@student.grit.demo",
  "dev.malhotra@student.grit.demo",
  "sara.khan@student.grit.demo",
  "ananya.iyer@student.grit.demo",
  "nikhil.joshi@student.grit.demo",
  "priya.nair@student.grit.demo",
  "arjun.desai@student.grit.demo",
  "tanya.bose@student.grit.demo",
  "aisha.siddiqui@student.grit.demo",
  "varun.pillai@student.grit.demo",
  "neel.bhatt@student.grit.demo",
  "riya.sen@student.grit.demo",
  "manav.gupta@student.grit.demo",
  "sneha.pillai@student.grit.demo",
  "vikram.sethi@grit.demo",
  "neha.kapoor@grit.demo",
  "aditya.menon@grit.demo",
  "fatima.sheikh@grit.demo",
  "priyanka.raman@grit.demo",
];

export const metadata = { title: "Demo access" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSessionUser();
  const [users] = await Promise.all([
    prisma.user.findMany({
      include: {
        student: { select: { studentCode: true, cohort: true } },
        interviewer: { select: { title: true } },
      },
    }),
  ]);

  const rank = new Map(ORDER.map((email, index) => [email, index]));
  const personas: DemoPersona[] = users
    .map((user) => ({
      email: user.email,
      name: user.name,
      role: user.role,
      title:
        user.student?.cohort ??
        user.student?.studentCode ??
        user.interviewer?.title ??
        "Interview operations",
      scenario: SCENARIOS[user.email] ?? "Demo workspace",
    }))
    .sort((a, b) => (rank.get(a.email) ?? 99) - (rank.get(b.email) ?? 99) || a.name.localeCompare(b.name));

  const initialRole =
    params.role === "interviewer" ? "INTERVIEWER" : params.role === "admin" ? "ADMIN" : "STUDENT";

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative hidden border-r border-line bg-[#f0efeb] p-10 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[11px] bg-ink text-[15px] font-semibold text-white">
            G
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight">GRIT</span>
            <span className="block text-[11px] font-medium text-muted">Interview Hub</span>
          </span>
        </Link>

        <div className="relative my-auto max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Demo access</p>
          <h1 className="mt-3 text-balance text-[34px] font-semibold leading-[1.12] tracking-[-0.03em]">
            Three roles. One accountable clearance process.
          </h1>
          <p className="mt-4 text-[14px] leading-7 text-muted">
            Choose a role, then pick any seeded persona. Each one drops you into a different real state — eligibility,
            booking, evaluation, publication, badge or an open operational issue.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              ["Student scenarios", "Eligible, booked, awaiting result, passed, failed, revoked, retake approved."],
              ["Interviewer scenarios", "Open availability, fully booked day, blocked window, pending evaluations."],
              ["Operations scenarios", "Overdue result, reassignment, retake appeal, integrity review."],
            ].map(([title, copy]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <div>
                  <p className="text-[13px] font-medium text-ink">{title}</p>
                  <p className="text-[12px] leading-5 text-muted">{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11.5px] text-muted">
          <ShieldCheck className="size-3.5" /> Signed http-only demo session · server-enforced role access
        </div>
      </div>

      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between px-4 py-4 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[10px] bg-ink text-[13px] font-semibold text-white">
              G
            </span>
            <span className="text-[14px] font-semibold tracking-tight">GRIT Interview Hub</span>
          </Link>
          <Link href="/" className="text-[12px] text-muted">
            Overview
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-6">
          <div className="w-full max-w-xl">
            {session ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c4e8df] bg-accent-soft px-4 py-3 text-[12.5px] text-accent-ink">
                <span>
                  Signed in as <span className="font-semibold">{session.name}</span>. Choose another persona below or
                  continue to your workspace.
                </span>
                <Link href={homeForRole(session.role)} className="inline-flex items-center gap-1 font-medium underline">
                  Open workspace <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : null}
            <DemoLogin
              personas={personas}
              initialRole={initialRole}
              error={params.error}
              demoMode={env.demoMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
