"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { demoLogin } from "@/app/actions/session";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";

export type DemoPersona = {
  email: string;
  name: string;
  role: "STUDENT" | "INTERVIEWER" | "ADMIN";
  title: string;
  scenario: string;
};

const roleMeta = {
  STUDENT: {
    label: "Student",
    heading: "Continue as Student",
    description:
      "See eligibility, book a slot, review results and follow the retake path. Start with Aarav, an eligible student with all five skills complete.",
    icon: <UserRound className="size-4" />,
  },
  INTERVIEWER: {
    label: "Interviewer",
    heading: "Continue as Interviewer",
    description:
      "Review the day, manage availability and submit structured evaluations. Start with Vikram, who has open slots and a pending evaluation.",
    icon: <Sparkles className="size-4" />,
  },
  ADMIN: {
    label: "Interview operations",
    heading: "Continue as Interview operations",
    description:
      "Work the operational queues: overdue results, reassignments, retakes, integrity cases and analytics.",
    icon: <ShieldCheck className="size-4" />,
  },
} as const;

export function DemoLogin({
  personas,
  initialRole,
  error,
  demoMode,
}: {
  personas: DemoPersona[];
  initialRole: "STUDENT" | "INTERVIEWER" | "ADMIN";
  error?: string;
  demoMode: boolean;
}) {
  const [role, setRole] = useState<"STUDENT" | "INTERVIEWER" | "ADMIN">(initialRole);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const meta = roleMeta[role];
  const rolePersonas = personas.filter((persona) => persona.role === role);
  const primary = rolePersonas[0];
  const filteredPersonas = (() => {
    const term = query.trim().toLowerCase();
    if (!term) return rolePersonas;
    return rolePersonas.filter((persona) =>
      `${persona.name} ${persona.title} ${persona.scenario}`.toLowerCase().includes(term),
    );
  })();

  return (
    <div className="w-full max-w-xl">
      {error ? (
        <div className="mb-4 rounded-xl border border-[#f5cfcb] bg-bad-soft px-4 py-3 text-[13px] text-bad">
          {error === "demo-disabled"
            ? "Demo access is disabled in this environment. Use the configured production sign-in."
            : "That demo account no longer exists. Reset the demo data from the admin console or reseed the database."}
        </div>
      ) : null}

      <div className="rounded-[20px] border border-line bg-surface p-5 shadow-pop sm:p-7">
        <div className="flex rounded-[11px] border border-line bg-[#f7f7f4] p-1" role="tablist" aria-label="Demo role">
          {(Object.keys(roleMeta) as Array<keyof typeof roleMeta>).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={role === key}
              onClick={() => {
                setRole(key);
                setQuery("");
              }}
              className={cn(
                "flex-1 rounded-[8px] px-2 py-2 text-[12.5px] font-medium transition-colors",
                role === key
                  ? "bg-surface text-ink shadow-card ring-1 ring-line"
                  : "text-muted hover:text-ink",
              )}
            >
              {roleMeta[key].label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2 text-accent">
            {meta.icon}
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]">Demo access</p>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{meta.heading}</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">{meta.description}</p>
        </div>

        {primary ? (
          <form action={demoLogin} className="mt-5">
            <input type="hidden" name="email" value={primary.email} />
            <button
              type="submit"
              disabled={!demoMode}
              className={buttonClasses("primary", "lg", "w-full")}
            >
              {meta.heading}
              <ArrowRight className="size-4" />
            </button>
            <p className="mt-2 text-center text-[11.5px] text-muted">
              Signs in as <span className="font-medium text-ink-soft">{primary.name}</span> · {primary.scenario}
            </p>
          </form>
        ) : (
          <p className="mt-5 rounded-lg border border-[#f2ddb8] bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            No demo personas exist. Seed the database first.
          </p>
        )}

        <div className="mt-5 rounded-[12px] border border-line bg-[#fafaf7] p-3">
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            aria-expanded={showAll}
            aria-controls="scenario-list"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">Or pick a specific scenario</span>
              <span className="block text-[11.5px] leading-5 text-muted">
                {rolePersonas.length} real {rolePersonas.length === 1 ? "state" : "states"} for this role
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent">
              {showAll ? "Hide" : "Browse"}
              <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} />
            </span>
          </button>

          {showAll ? (
            <div id="scenario-list" className="mt-3 border-t border-line pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, journey or issue"
                  aria-label="Search demo scenarios"
                  className="h-9 w-full rounded-[9px] border border-line-strong bg-surface pl-9 pr-3 text-[12.5px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                />
              </div>
              <div className="mt-2 max-h-[286px] space-y-1 overflow-y-auto pr-1">
                {filteredPersonas.length === 0 ? (
                  <p className="rounded-[9px] border border-dashed border-line px-3 py-6 text-center text-[12px] text-muted">
                    No scenarios match “{query.trim()}”.
                  </p>
                ) : (
                  filteredPersonas.map((persona) => (
                    <form key={persona.email} action={demoLogin}>
                      <input type="hidden" name="email" value={persona.email} />
                      <button
                        type="submit"
                        disabled={!demoMode}
                        className="group flex w-full items-center justify-between gap-3 rounded-[10px] border border-transparent px-2.5 py-2 text-left transition-colors hover:border-line hover:bg-surface disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{persona.name}</span>
                          <span className="block truncate text-[11.5px] text-muted">
                            {persona.title} · {persona.scenario}
                          </span>
                        </span>
                        <ArrowRight className="size-3.5 shrink-0 text-zinc-300 group-hover:text-accent" />
                      </button>
                    </form>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-start gap-2.5 rounded-[11px] border border-line bg-[#fafaf7] px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-[11.5px] leading-5 text-muted">
            {demoMode
              ? "This is a demo environment. Sign-in uses seeded personas rather than passwords, and the session is a signed, http-only cookie."
              : "Demo sign-in is disabled outside demo mode."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px]">
        <Link href="/" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Back to overview
        </Link>
        <span className="text-muted">Session expires after 7 days</span>
      </div>
    </div>
  );
}
