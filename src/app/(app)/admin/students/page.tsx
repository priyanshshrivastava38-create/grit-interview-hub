import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
  TableCell,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Students" };

const filters = [
  { key: "ALL", label: "All students" },
  { key: "ELIGIBLE", label: "Eligible" },
  { key: "NOT_ELIGIBLE", label: "Not eligible" },
  { key: "ELIGIBILITY_REVOKED", label: "Revoked" },
  { key: "BOOKED", label: "Booked" },
];

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const status = filters.some((filter) => filter.key === params.status) ? (params.status as string) : "ALL";

  const students = await prisma.studentProfile.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { studentCode: { contains: query, mode: "insensitive" } },
                { cohort: { contains: query, mode: "insensitive" } },
                { user: { name: { contains: query, mode: "insensitive" } } },
                { user: { email: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {},
        status === "ELIGIBLE" || status === "NOT_ELIGIBLE" || status === "ELIGIBILITY_REVOKED"
          ? { eligibilityStatus: status }
          : {},
        status === "BOOKED" ? { bookings: { some: { status: "CONFIRMED" } } } : {},
      ],
    },
    include: {
      user: true,
      skills: { include: { skill: true }, orderBy: { skill: { sortOrder: "asc" } } },
      badgeAwards: { include: { badge: true }, take: 1 },
      interviews: {
        include: { result: true, interviewType: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { bookings: true, retakes: true } },
    },
    orderBy: [{ eligibilityStatus: "asc" }, { user: { name: "asc" } }],
    take: 200,
  });

  const counts = await prisma.studentProfile.groupBy({
    by: ["eligibilityStatus"],
    _count: { _all: true },
  });
  const countFor = (key: string) =>
    key === "ALL"
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.eligibilityStatus === key)?._count._all ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Students"
        description="Eligibility, progress and interview history for every student in the program."
        actions={
          <Link href="/admin/analytics" className={buttonClasses("outline", "sm")}>
            Analytics
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/students">
        <input type="hidden" name="status" value={status === "ALL" ? "" : status} />
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name, code, cohort or email"
            className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            aria-label="Search students"
          />
        </div>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Search
        </button>
        {query || status !== "ALL" ? (
          <Link href="/admin/students" className={buttonClasses("ghost", "md")}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((filter) => {
          const href =
            filter.key === "ALL"
              ? query
                ? `/admin/students?q=${encodeURIComponent(query)}`
                : "/admin/students"
              : `/admin/students?status=${filter.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
          const active = status === filter.key;
          return (
            <Link
              key={filter.key}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {filter.label}
              {filter.key !== "BOOKED" ? (
                <span className={cn("rounded-full px-1.5 text-[10.5px] tabular", active ? "bg-white/15" : "bg-black/[0.05]")}>
                  {countFor(filter.key)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {students.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="size-4" />}
            title="No students match this view"
            description="Try a different search term or eligibility filter."
            action={
              <Link href="/admin/students" className={buttonClasses("outline", "sm")}>
                Reset filters
              </Link>
            }
          />
        </Card>
      ) : (
        <TableShell>
          <TableHead>
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Student</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Cohort</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Eligibility</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Progress</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Latest interview</TableCell>
              <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Badge</TableCell>
              <TableCell className="text-right text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Open</TableCell>
            </TableRow>
          </TableHead>
          <tbody>
            {students.map((student) => {
              const completed = student.skills.filter((skill) => skill.status === "COMPLETED").length;
              const latest = student.interviews[0];
              const award = student.badgeAwards[0];
              return (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={student.user.name} className="size-8 text-[11px]" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{student.user.name}</p>
                        <p className="text-[11px] text-muted">{student.studentCode}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-[12.5px]">{student.cohort}</p>
                    <p className="text-[11px] text-muted">{student.program}</p>
                  </TableCell>
                  <TableCell>
                    <StatusPill value={student.eligibilityStatus} />
                  </TableCell>
                  <TableCell className="text-[12.5px] tabular">
                    {completed}/{student.skills.length}
                  </TableCell>
                  <TableCell>
                    {latest ? (
                      <>
                        <p className="text-[12.5px]">{latest.interviewType.code}</p>
                        <p className="flex items-center gap-1.5 text-[11px] text-muted">
                          {latest.result?.outcome ? (
                            <StatusPill value={latest.result.outcome} />
                          ) : (
                            <StatusPill value={latest.status} />
                          )}
                          <span>{latest.resultPublishedAt ? formatDate(latest.resultPublishedAt) : ""}</span>
                        </p>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted">No interviews</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {award ? (
                      <div className="flex items-center gap-1.5">
                        <Badge tone="neutral">{award.badge.code}</Badge>
                        <StatusPill value={award.status} />
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="text-[12px] font-medium text-accent hover:underline"
                    >
                      View profile
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <p className="mt-3 text-[11.5px] text-muted">
        Showing {students.length} student{students.length === 1 ? "" : "s"}. Eligibility can be revoked or restored from a
        student profile, with a reason recorded in the audit trail.
      </p>
    </div>
  );
}
