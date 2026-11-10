"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Gauge,
  LogOut,
  Menu,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/app/actions/session";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { Avatar } from "@/components/ui";
import { cn, roleLabel } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number };
type NavGroup = { title: string; items: NavItem[] };

const icons = {
  overview: <Gauge className="size-[18px]" />,
  book: <CalendarPlus className="size-[18px]" />,
  interviews: <CalendarDays className="size-[18px]" />,
  badge: <Award className="size-[18px]" />,
  notifications: <Bell className="size-[18px]" />,
  schedule: <CalendarCheck2 className="size-[18px]" />,
  availability: <ClipboardList className="size-[18px]" />,
  history: <ClipboardCheck className="size-[18px]" />,
  students: <Users className="size-[18px]" />,
  bookings: <CalendarDays className="size-[18px]" />,
  interviewers: <Users className="size-[18px]" />,
  results: <ClipboardCheck className="size-[18px]" />,
  retakes: <RotateCcw className="size-[18px]" />,
  malpractice: <ShieldAlert className="size-[18px]" />,
  analytics: <BarChart3 className="size-[18px]" />,
  audit: <ScrollText className="size-[18px]" />,
};

function navFor(role: string, unread: number): NavGroup[] {
  const notifications: NavItem = {
    href: "/notifications",
    label: "Notifications",
    icon: icons.notifications,
    badge: unread > 0 ? unread : undefined,
  };
  if (role === "STUDENT") {
    return [
      {
        title: "Your clearance",
        items: [
          { href: "/student", label: "Overview", icon: icons.overview },
          { href: "/student/book", label: "Book an interview", icon: icons.book },
          { href: "/student/interviews", label: "My interviews", icon: icons.interviews },
          { href: "/student/badge", label: "Badge status", icon: icons.badge },
        ],
      },
      { title: "Account", items: [notifications] },
    ];
  }
  if (role === "INTERVIEWER") {
    return [
      {
        title: "Interview desk",
        items: [
          { href: "/interviewer", label: "Today’s overview", icon: icons.overview },
          { href: "/interviewer/interviews", label: "Interview schedule", icon: icons.schedule },
          { href: "/interviewer/availability", label: "Availability", icon: icons.availability },
          { href: "/interviewer/history", label: "Evaluation history", icon: icons.history },
        ],
      },
      { title: "Account", items: [notifications] },
    ];
  }
  return [
    {
      title: "Operations",
      items: [
        { href: "/admin", label: "Command centre", icon: icons.overview },
        { href: "/admin/students", label: "Students", icon: icons.students },
        { href: "/admin/bookings", label: "Bookings", icon: icons.bookings },
        { href: "/admin/interviewers", label: "Interviewers", icon: icons.interviewers },
        { href: "/admin/results", label: "Result publication", icon: icons.results },
        { href: "/admin/retakes", label: "Retake requests", icon: icons.retakes },
        { href: "/admin/malpractice", label: "Integrity cases", icon: icons.malpractice },
      ],
    },
    {
      title: "Insight",
      items: [
        { href: "/admin/analytics", label: "Analytics", icon: icons.analytics },
        { href: "/admin/audit", label: "Audit trail", icon: icons.audit },
      ],
    },
    { title: "Account", items: [notifications] },
  ];
}

const titleMap: Array<[string, string]> = [
  ["/student/book", "Book an interview"],
  ["/student/interviews", "My interviews"],
  ["/student/badge", "Badge status"],
  ["/student", "Overview"],
  ["/interviewer/availability", "Availability"],
  ["/interviewer/interviews", "Interview schedule"],
  ["/interviewer/history", "Evaluation history"],
  ["/interviewer", "Today’s overview"],
  ["/admin/students", "Students"],
  ["/admin/bookings", "Bookings"],
  ["/admin/interviewers", "Interviewers"],
  ["/admin/results", "Result publication"],
  ["/admin/retakes", "Retake requests"],
  ["/admin/malpractice", "Integrity cases"],
  ["/admin/analytics", "Analytics"],
  ["/admin/audit", "Audit trail"],
  ["/admin", "Command centre"],
  ["/notifications", "Notifications"],
];

function titleFor(pathname: string): string {
  for (const [prefix, title] of titleMap) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return "GRIT";
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/student" || href === "/interviewer" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  unread,
  demoMode,
  timezoneLabel,
  children,
}: {
  user: { name: string; email: string; role: string; timezone: string };
  unread: number;
  demoMode: boolean;
  timezoneLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = navFor(user.role, unread);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-5 pt-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-9 place-items-center rounded-[11px] bg-ink text-[15px] font-semibold tracking-tight text-white">
            G
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-ink">GRIT</span>
            <span className="block text-[11px] font-medium text-muted">Interview Hub</span>
          </span>
        </Link>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted hover:bg-black/[0.04] lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-4.5" />
        </button>
      </div>

      {demoMode ? (
        <div className="mx-3 mb-4 rounded-[12px] border border-line bg-[#fafaf7] px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
            <span className="size-1.5 rounded-full bg-accent" /> Demo workspace
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">Seeded data. Explore freely and switch roles anytime.</p>
        </div>
      ) : null}

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-zinc-500">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center justify-between gap-2 rounded-[9px] px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-white text-ink shadow-card ring-1 ring-line"
                          : "text-ink-soft hover:bg-white/70 hover:text-ink",
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={active ? "text-accent" : "text-zinc-400 group-hover:text-zinc-500"}>
                          {item.icon}
                        </span>
                        {item.label}
                      </span>
                      {item.badge ? (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        {user.role === "ADMIN" && demoMode ? (
          <div className="mb-2 px-1">
            <ResetDemoButton />
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
          <Avatar name={user.name} className="size-8 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{roleLabel(user.role)}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-1 px-1">
          <Link
            href="/login"
            className="rounded-md px-1.5 py-1 text-[11px] font-medium text-muted hover:text-ink"
          >
            Switch role
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted hover:text-ink"
            >
              <LogOut className="size-3" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-[#f2f1ed] lg:block">
        {nav}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-[#f2f1ed] shadow-pop"
          >
            {nav}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-ml-1 rounded-md p-2 text-ink-soft hover:bg-black/[0.04] lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="mobile-navigation"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-[13px] font-semibold tracking-tight text-ink">{titleFor(pathname)}</p>
            <div className="ml-auto flex items-center gap-1.5">
              <span
                className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-card sm:inline-flex"
                title={`All times shown in ${user.timezone}`}
              >
                <Clock className="size-3.5 text-muted" /> {timezoneLabel}
              </span>
              <Link
                href="/notifications"
                className="relative inline-flex size-9 items-center justify-center rounded-[9px] text-ink-soft hover:bg-white hover:shadow-card"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              >
                <Bell className="size-[18px]" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-canvas" />
                ) : null}
              </Link>
              <Link
                href={
                  user.role === "STUDENT"
                    ? "/student"
                    : user.role === "INTERVIEWER"
                      ? "/interviewer"
                      : "/admin"
                }
                className="ml-0.5 rounded-full"
                aria-label="Your profile"
              >
                <Avatar name={user.name} className="size-8 text-[11px]" />
              </Link>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
