import Link from "next/link";
import { ScrollText, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  PageHeader,
  TableCell,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { humanize } from "@/lib/state-machine";

export const metadata = { title: "Audit trail" };

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const entity = params.entity ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(query
      ? {
          OR: [
            { action: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
            { actor: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(entity ? { entityType: entity } : {}),
  };

  const [entries, total, entityGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entityType"], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        eyebrow="Insight"
        title="Audit trail"
        description="Immutable record of sensitive operations: bookings, results, eligibility, badges, retakes and integrity cases."
        actions={<Badge tone="neutral">{total} events</Badge>}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/audit">
        {entity ? <input type="hidden" name="entity" value={entity} /> : null}
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search action, summary or actor"
            className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            aria-label="Search audit trail"
          />
        </div>
        <select
          name="entity"
          defaultValue={entity}
          className="h-10 rounded-[10px] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          aria-label="Filter by entity type"
        >
          <option value="">All entities</option>
          {entityGroups.map((group) => (
            <option key={group.entityType} value={group.entityType}>
              {humanize(group.entityType)} ({group._count._all})
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Filter
        </button>
        {query || entity ? (
          <Link href="/admin/audit" className={buttonClasses("ghost", "md")}>
            Clear
          </Link>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText className="size-4" />}
            title="No audit events match"
            description="Try a different search term or entity type."
          />
        </Card>
      ) : (
        <>
          <TableShell>
            <TableHead>
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">When</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Action</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Actor</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Record</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Summary</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Change</TableCell>
              </TableRow>
            </TableHead>
            <tbody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-[11.5px] text-muted">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="text-[12px] font-medium text-ink">{humanize(entry.action.replaceAll(".", " "))}</p>
                    <p className="text-[10.5px] text-zinc-400">{entry.action}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-[12px]">{entry.actor?.name ?? "System"}</p>
                    <p className="text-[10.5px] text-muted">{entry.actor?.role ? humanize(entry.actor.role) : "—"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-[11.5px]">{humanize(entry.entityType)}</p>
                    <p className="max-w-[120px] truncate text-[10px] text-zinc-400" title={entry.entityId}>
                      {entry.entityId}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="text-[11.5px] leading-5 text-ink-soft">{entry.summary}</p>
                  </TableCell>
                  <TableCell>
                    {entry.previousValue || entry.newValue ? (
                      <details className="group">
                        <summary className="cursor-pointer text-[11px] font-medium text-accent hover:underline">
                          View JSON
                        </summary>
                        <pre className="mt-1 max-h-40 max-w-[320px] overflow-auto rounded-lg bg-ink px-2.5 py-2 text-[10px] leading-4 text-zinc-100">
{JSON.stringify({ previous: entry.previousValue, next: entry.newValue }, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </TableShell>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-muted">
              Page {page} of {totalPages} · {total} event{total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-1.5">
              {page > 1 ? (
                <Link
                  href={`/admin/audit?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(entity ? { entity } : {}), page: String(page - 1) }).toString()}`}
                  className={buttonClasses("outline", "sm")}
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/admin/audit?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(entity ? { entity } : {}), page: String(page + 1) }).toString()}`}
                  className={buttonClasses("outline", "sm")}
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}

      <p className="mt-4 text-[11.5px] text-muted">
        Audit events are append-only. Each entry captures the actor, role, entity, human summary and before/after values.
      </p>
    </div>
  );
}
