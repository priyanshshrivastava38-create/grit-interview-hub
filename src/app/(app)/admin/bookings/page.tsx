import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarX2,
  Search,
  UserRoundX,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import type { BookingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  adminCancelBookingAction,
  markNoShowAction,
  reassignInterviewAction,
} from "@/app/actions/admin";
import { ActionForm, Modal } from "@/components/action-form";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  InfoBanner,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { dateKeyInTz, formatDateTime, formatDayLabel, relativeTime, timeInTz } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Bookings" };

const fieldClasses =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

const tabs = [
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_SHOW", label: "No-show" },
  { key: "RESCHEDULED", label: "Rescheduled" },
  { key: "ALL", label: "All records" },
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status = tabs.some((tab) => tab.key === params.status) ? (params.status as string) : "CONFIRMED";
  const query = (params.q ?? "").trim();
  const now = new Date();

  const [bookings, openSlots] = await Promise.all([
    prisma.interviewBooking.findMany({
      where: {
        ...(status === "ALL" ? {} : { status: status as BookingStatus }),
        ...(query
          ? {
              student: {
                OR: [
                  { studentCode: { contains: query, mode: "insensitive" } },
                  { user: { name: { contains: query, mode: "insensitive" } } },
                ],
              },
            }
          : {}),
      },
      include: {
        student: { include: { user: true } },
        slot: { include: { availability: true } },
        interview: {
          include: {
            interviewType: true,
            interviewer: { include: { user: true } },
            evaluation: true,
            result: true,
          },
        },
        rescheduledFrom: { include: { slot: true } },
      },
      orderBy: [{ bookedAt: "desc" }],
      take: 150,
    }),
    prisma.interviewSlot.findMany({
      where: { status: "OPEN", startsAt: { gt: now } },
      include: { interviewer: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
      take: 250,
    }),
  ]);

  const slotGroups = new Map<string, typeof openSlots>();
  for (const slot of openSlots) {
    const key = dateKeyInTz(slot.startsAt);
    const group = slotGroups.get(key) ?? [];
    group.push(slot);
    slotGroups.set(key, group);
  }

  const counts = await prisma.interviewBooking.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countFor = (key: string) =>
    key === "ALL"
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === key)?._count._all ?? 0);

  const flagged = bookings.filter(
    (booking) =>
      booking.status === "CONFIRMED" && (booking.slot.availability.status === "BLOCKED" || !booking.interview?.interviewer.isActive),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Reassign, cancel and record no-shows. Every change is transition-checked and audited."
        actions={
          <Link href="/admin/students" className={buttonClasses("outline", "sm")}>
            Students
          </Link>
        }
      />

      {flagged.length > 0 ? (
        <div className="mb-4">
          <InfoBanner tone="warn" title={`${flagged.length} booking${flagged.length === 1 ? " needs" : "s need"} reassignment`}>
            The interviewer or availability window for these confirmed bookings changed after booking. Move the student to
            an open slot below.
          </InfoBanner>
        </div>
      ) : null}

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/bookings">
        <input type="hidden" name="status" value={status} />
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search student name or code"
            className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            aria-label="Search bookings"
          />
        </div>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Search
        </button>
        {query ? (
          <Link href={`/admin/bookings?status=${status}`} className={buttonClasses("ghost", "md")}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const href = `/admin/bookings?status=${tab.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
          const active = status === tab.key;
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {tab.label}
              <span className={cn("rounded-full px-1.5 text-[10.5px] tabular", active ? "bg-white/15" : "bg-black/[0.05]")}>
                {countFor(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>

      {bookings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-4" />}
            title="No bookings in this view"
            description={query ? "No booking matches that student." : "Nothing needs attention in this status."}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const interview = booking.interview;
            const needsReassign =
              booking.status === "CONFIRMED" &&
              (booking.slot.availability.status === "BLOCKED" || !interview?.interviewer.isActive);
            const upcoming = booking.slot.startsAt.getTime() > now.getTime();
            return (
              <Card
                key={booking.id}
                className={cn("p-4", needsReassign && "border-[#f2ddb8] bg-[#fffdf8]")}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={booking.student.user.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/students/${booking.studentId}`}
                        className="text-[13.5px] font-semibold hover:text-accent"
                      >
                        {booking.student.user.name}
                      </Link>
                      <span className="text-[11px] text-muted">{booking.student.studentCode}</span>
                      <StatusPill value={booking.status} />
                      {needsReassign ? <Badge tone="warn">Reassignment needed</Badge> : null}
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {interview?.interviewType.name ?? `Attempt ${booking.attemptNumber}`} ·{" "}
                      {formatDateTime(booking.slot.startsAt)} · with {interview?.interviewer.user.name ?? "unassigned"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Booked {relativeTime(booking.bookedAt, now)}
                      {booking.cancellationReason ? ` · ${booking.cancellationReason}` : ""}
                      {booking.rescheduledFrom ? ` · moved from ${formatDateTime(booking.rescheduledFrom.slot.startsAt)}` : ""}
                    </p>
                    {interview?.result ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px]">
                        Published <StatusPill value={interview.result.outcome} />
                      </p>
                    ) : interview?.evaluation ? (
                      <p className="mt-1 text-[11px] text-warn">Evaluation submitted — awaiting publication</p>
                    ) : null}
                  </div>

                  {booking.status === "CONFIRMED" ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Modal
                        trigger={
                          <>
                            <CalendarDays className="size-3.5" /> Reassign
                          </>
                        }
                        title="Reassign interview"
                        description="Move this booking to an open slot. The current booking is preserved in history."
                        wide
                      >
                        <ActionForm action={reassignInterviewAction} successMessage="Interview reassigned">
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`slot-${booking.id}`}>
                            New slot
                          </label>
                          {openSlots.length === 0 ? (
                            <p className="mt-2 rounded-lg bg-[#fafaf7] px-3 py-2 text-[12px] text-muted">
                              No open slots are published. Ask interviewers to add availability first.
                            </p>
                          ) : (
                            <select id={`slot-${booking.id}`} name="newSlotId" required className={`mt-1.5 ${fieldClasses}`}>
                              <option value="">Choose an open slot</option>
                              {Array.from(slotGroups.entries()).map(([day, slots]) => (
                                <optgroup key={day} label={formatDayLabel(slots[0].startsAt)}>
                                  {slots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                      {timeInTz(slot.startsAt)} · {slot.interviewer.user.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          )}
                          <p className="mt-2 text-[11.5px] leading-5 text-muted">
                            The student is notified and the original booking stays in their history as rescheduled.
                          </p>
                          <div className="mt-4 flex justify-end">
                            <button
                              type="submit"
                              disabled={openSlots.length === 0}
                              className={buttonClasses("primary", "sm")}
                            >
                              Reassign booking
                            </button>
                          </div>
                        </ActionForm>
                      </Modal>

                      {!upcoming ? (
                        <Modal
                          trigger={
                            <>
                              <UserRoundX className="size-3.5" /> No-show
                            </>
                          }
                          title="Record a no-show"
                          description="Use this only after the interview window has passed and the student did not attend."
                        >
                          <ActionForm action={markNoShowAction} successMessage="No-show recorded">
                            <input type="hidden" name="bookingId" value={booking.id} />
                            <p className="text-[13px] leading-6 text-ink-soft">
                              This marks the booking as a no-show, completes the interview record and notifies{" "}
                              <strong>{booking.student.user.name}</strong>. The slot will not be released automatically.
                            </p>
                            <div className="mt-4 flex justify-end">
                              <button type="submit" className={buttonClasses("danger", "sm")}>
                                Confirm no-show
                              </button>
                            </div>
                          </ActionForm>
                        </Modal>
                      ) : null}

                      <Modal
                        trigger={
                          <>
                            <CalendarX2 className="size-3.5" /> Cancel
                          </>
                        }
                        title="Cancel booking"
                        description="Cancelling releases the slot if it is still in the future and notifies the student."
                      >
                        <ActionForm action={adminCancelBookingAction} successMessage="Booking cancelled">
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <label className="block text-[13px] font-medium text-ink-soft" htmlFor={`cancel-${booking.id}`}>
                            Reason
                          </label>
                          <textarea
                            id={`cancel-${booking.id}`}
                            name="reason"
                            required
                            minLength={5}
                            rows={3}
                            className={`mt-1.5 ${fieldClasses}`}
                            placeholder="Reason shared with the student in their cancellation notification."
                          />
                          <div className="mt-4 flex justify-end">
                            <button type="submit" className={buttonClasses("danger", "sm")}>
                              Cancel booking
                            </button>
                          </div>
                        </ActionForm>
                      </Modal>
                    </div>
                  ) : (
                    <Link
                      href={interview ? `/admin/results?q=${encodeURIComponent(booking.student.user.name)}` : "/admin/bookings"}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                    >
                      {booking.status === "COMPLETED" ? "View result" : "View record"} <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {status === "CONFIRMED" && bookings.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted">
          <AlertTriangle className="size-3.5" /> Reassignment preserves history: the old booking is marked rescheduled and a
          new confirmed booking is created.
        </p>
      ) : null}
    </div>
  );
}
