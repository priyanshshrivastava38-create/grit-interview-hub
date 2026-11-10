import Link from "next/link";
import {
  Award,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Info,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { getBookingEligibility, BOOKING_POLICY } from "@/lib/booking-eligibility";
import { prisma } from "@/lib/db";
import {
  Avatar,
  Badge,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  InfoBanner,
  PageHeader,
  selectClasses,
} from "@/components/ui";
import { BookSlotButton } from "@/components/booking-button";
import {
  addDays,
  dateKeyInTz,
  formatDate,
  formatDayLabel,
  formatLongDate,
  minutesBetween,
  timeInTz,
  tzAbbreviation,
} from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Book an interview" };

export default async function StudentBookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; interviewer?: string; preview?: string }>;
}) {
  const user = await requireStudent();
  const params = await searchParams;
  const now = new Date();

  const [eligibility, interviewType, interviewers] = await Promise.all([
    getBookingEligibility(prisma, user.studentId, undefined, now),
    prisma.interviewType.findFirst({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.interviewerProfile.findMany({
      where: { isActive: true },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const interviewerFilter =
    params.interviewer && interviewers.some((interviewer) => interviewer.id === params.interviewer)
      ? params.interviewer
      : undefined;

  const rawSlots = await prisma.interviewSlot.findMany({
    where: {
      status: "OPEN",
      startsAt: { gte: now, lte: addDays(now, 21) },
      interviewer: { isActive: true },
      availability: { status: "ACTIVE" },
      ...(interviewerFilter ? { interviewerId: interviewerFilter } : {}),
    },
    include: {
      interviewer: { include: { user: { select: { name: true } } } },
      availability: { select: { slotMinutes: true, note: true, status: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
  });

  const slots = rawSlots.filter(
    (slot) => slot.startsAt.getTime() - now.getTime() >= BOOKING_POLICY.minimumLeadMinutes * 60_000,
  );

  const byDate = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = dateKeyInTz(slot.startsAt);
    const list = byDate.get(key) ?? [];
    list.push(slot);
    byDate.set(key, list);
  }
  const dateKeys = Array.from(byDate.keys()).sort();
  const selectedDate =
    params.date && byDate.has(params.date) ? params.date : (dateKeys[0] ?? null);
  const daySlots = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const filterQuery = interviewerFilter ? `&interviewer=${interviewerFilter}` : "";
  const showAvailability = eligibility.allowed || params.preview === "1";

  const blocked = eligibility.allowed
    ? null
    : eligibility.code === "ACTIVE_BOOKING"
      ? {
          title: "You’re already booked — one interview at a time",
          body: "Your confirmed interview is waiting in My interviews. You can reschedule or cancel it there before booking another attempt.",
          icon: <CalendarCheck2 className="size-5" />,
          href: "/student/interviews",
          label: "Manage my booking",
        }
      : eligibility.code === "WAIT_PERIOD"
        ? {
            title: "Your next attempt isn’t open yet",
            body: "The waiting period after a result is part of the programme policy. You can request an earlier review or check your dashboard for the exact date.",
            icon: <Clock className="size-5" />,
            href: "/student/interviews",
            label: "View my retake date",
          }
        : eligibility.code === "BADGE"
          ? {
              title: "Your badge status is already settled",
              body: "You either hold the badge or it is paused for review, so no further interview is required right now.",
              icon: <Award className="size-5" />,
              href: "/student/badge",
              label: "Open badge status",
            }
          : {
              title: "Booking is paused",
              body: eligibility.message,
              icon: <Lock className="size-5" />,
              href: "/student",
              label: "Back to my overview",
            };

  return (
    <div>
      <PageHeader
        eyebrow="Student · Booking"
        title="Choose your interview slot"
        description={
          interviewType
            ? `${interviewType.name} · ${interviewType.durationMinutes} minutes · times shown in ${tzAbbreviation()}`
            : "Available interview times"
        }
        actions={
          <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
            <CalendarDays className="size-3.5" /> My interviews
          </Link>
        }
      />

      {showAvailability ? (
        eligibility.allowed ? (
        <InfoBanner
          tone="accent"
          title="You are eligible to book"
          action={<Badge tone="accent">Attempt {eligibility.attemptNumber}</Badge>}
        >
          Select a slot below. The slot is re-checked inside a database transaction when you confirm, so two students
          cannot hold the same interview.
        </InfoBanner>
      ) : (
        <InfoBanner
          tone={eligibility.code === "ACTIVE_BOOKING" ? "info" : eligibility.code === "ELIGIBILITY" ? "bad" : "warn"}
          title={
            eligibility.code === "ACTIVE_BOOKING"
              ? "You already have a confirmed booking"
              : eligibility.code === "BADGE"
                ? "Your badge status blocks new bookings"
                : eligibility.code === "WAIT_PERIOD"
                  ? "Your retake window has not opened yet"
                  : eligibility.code === "ATTEMPTS"
                    ? "No attempts remaining"
                    : "Booking is not available"
          }
          action={
            eligibility.code === "ACTIVE_BOOKING" ? (
              <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
                Manage booking
              </Link>
            ) : eligibility.code === "WAIT_PERIOD" ? (
              <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
                Request earlier review
              </Link>
            ) : (
              <Link href="/student" className={buttonClasses("outline", "sm")}>
                Back to overview
              </Link>
            )
          }
        >
          {eligibility.message}
        </InfoBanner>
        )
      ) : null}

      {!eligibility.allowed && params.preview === "1" ? (
        <InfoBanner
          tone="neutral"
          className="mt-3"
          title="Preview only"
          action={
            <Link href={`/student/book${interviewerFilter ? `?interviewer=${interviewerFilter}` : ""}`} className={buttonClasses("outline", "sm")}>
              Back to guidance
            </Link>
          }
        >
          You can browse times, but booking stays locked until your eligibility changes. Nothing on this page can
          create a reservation.
        </InfoBanner>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_280px]">
        <div>
          {showAvailability ? (
            <Card>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                <Filter className="size-3.5 text-muted" /> Filter
              </span>
              <form method="get" className="flex flex-1 flex-wrap items-center gap-2">
                <label htmlFor="interviewer" className="sr-only">
                  Interviewer
                </label>
                <select
                  id="interviewer"
                  name="interviewer"
                  defaultValue={interviewerFilter ?? ""}
                  className={cn(selectClasses, "h-8 w-auto min-w-[180px] text-[12.5px]")}
                >
                  <option value="">All interviewers</option>
                  {interviewers.map((interviewer) => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.user.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonClasses("secondary", "sm")}>
                  Apply
                </button>
                {interviewerFilter ? (
                  <Link href="/student/book" className="text-[12px] text-muted hover:text-ink">
                    Reset
                  </Link>
                ) : null}
                <span className="ml-auto text-[11.5px] text-muted">
                  {slots.length} open slot{slots.length === 1 ? "" : "s"} in the next 21 days
                </span>
              </form>
            </div>

            {dateKeys.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus className="size-4" />}
                title="No open slots match this filter"
                description="Interviewers publish availability regularly. Try removing the interviewer filter or check back shortly."
                action={
                  interviewerFilter ? (
                    <Link href="/student/book" className={buttonClasses("outline", "sm")}>
                      Clear filter
                    </Link>
                  ) : null
                }
              />
            ) : (
              <>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
                  {dateKeys.slice(0, 12).map((key) => {
                    const date = new Date(`${key}T00:00:00.000Z`);
                    const count = byDate.get(key)?.length ?? 0;
                    const active = key === selectedDate;
                    const href = `/student/book?date=${key}${filterQuery}`;
                    return (
                      <Link
                        key={key}
                        href={href}
                        className={cn(
                          "flex min-w-[92px] flex-col rounded-[10px] border px-3 py-2 transition-colors",
                          active
                            ? "border-accent/40 bg-accent-soft text-accent-ink"
                            : "border-line bg-surface text-ink-soft hover:border-line-strong",
                        )}
                      >
                        <span className="text-[10.5px] font-medium uppercase tracking-[0.06em]">
                          {formatDayLabel(date)}
                        </span>
                        <span className="mt-0.5 text-[12.5px] font-semibold">{formatDate(date).slice(0, 6)}</span>
                        <span className="mt-0.5 text-[10.5px] opacity-75">
                          {count} slot{count === 1 ? "" : "s"}
                        </span>
                      </Link>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-[13px] font-semibold">
                      {selectedDate ? formatLongDate(new Date(`${selectedDate}T00:00:00.000Z`)) : ""}
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {daySlots.length} available · all times in {tzAbbreviation()}
                    </p>
                  </div>
                  <Badge tone={eligibility.allowed ? "neutral" : "warn"} dot>
                    {eligibility.allowed ? "Live availability" : "Preview only"}
                  </Badge>
                </div>

                <ul className="divide-y divide-line border-t border-line">
                  {daySlots.map((slot) => (
                    <li key={slot.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="w-[110px] shrink-0">
                        <p className="text-[14px] font-semibold tabular">{timeInTz(slot.startsAt)}</p>
                        <p className="text-[11px] text-muted">
                          to {timeInTz(slot.endsAt)} · {minutesBetween(slot.startsAt, slot.endsAt)} min
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Avatar name={slot.interviewer.user.name} className="size-8 text-[11px]" />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium">{slot.interviewer.user.name}</p>
                          <p className="truncate text-[11px] text-muted">
                            {slot.interviewer.title} · {slot.interviewer.specialty}
                          </p>
                        </div>
                      </div>
                      <div className="w-[150px] shrink-0">
                        {eligibility.allowed ? (
                          <BookSlotButton
                            slotId={slot.id}
                            compact
                            slotDate={formatLongDate(new Date(`${dateKeyInTz(slot.startsAt)}T00:00:00.000Z`))}
                            slotTime={`${timeInTz(slot.startsAt)}–${timeInTz(slot.endsAt)}`}
                            interviewerName={slot.interviewer.user.name}
                            cancellationHours={BOOKING_POLICY.cancellationHours}
                          />
                        ) : (
                          <span
                            className="flex h-9 items-center justify-end gap-1.5 pr-1 text-[12px] font-medium text-muted"
                            title={eligibility.message}
                          >
                            <Eye className="size-3.5" /> Open
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-6 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Next step</p>
              </div>
              <div className="px-6 py-7 sm:px-8 sm:py-9">
                <span className="grid size-11 place-items-center rounded-[12px] bg-accent-soft text-accent-ink">
                  {blocked?.icon}
                </span>
                <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-ink">{blocked?.title}</h2>
                <p className="mt-2 max-w-xl text-[13.5px] leading-6 text-muted">{blocked?.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={blocked?.href ?? "/student"} className={buttonClasses("primary", "md")}>
                    {blocked?.label} <ChevronRight className="size-4" />
                  </Link>
                  <Link
                    href={`/student/book?preview=1${filterQuery}`}
                    className={buttonClasses("outline", "md")}
                  >
                    <Eye className="size-4" /> Preview available times
                  </Link>
                </div>
                <p className="mt-4 text-[12px] leading-5 text-muted">
                  Slots are only reserved after confirmation, so previewing availability cannot create a booking.
                </p>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Booking policy" action={<ShieldCheck className="size-4 text-muted" />} />
            <CardBody className="space-y-2.5 text-[12.5px] leading-5 text-ink-soft">
              <p className="flex gap-2">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-accent" /> Slots must be booked at least{" "}
                {BOOKING_POLICY.minimumLeadMinutes} minutes in advance.
              </p>
              <p className="flex gap-2">
                <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-accent" /> Only one confirmed booking is
                allowed at a time.
              </p>
              <p className="flex gap-2">
                <Users className="mt-0.5 size-3.5 shrink-0 text-accent" /> Cancellations up to{" "}
                {BOOKING_POLICY.cancellationHours} hours before are allowed without an operations review.
              </p>
              <p className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-accent" /> Confirmation is atomic. If another student
                takes the slot first, you will be asked to choose another time.
              </p>
            </CardBody>
          </Card>

          <Card className="bg-[#fafaf7]">
            <CardBody className="text-[12px] leading-5 text-muted">
              <p className="flex items-center gap-1.5 font-medium text-ink-soft">
                <Info className="size-3.5" /> Timezone
              </p>
              <p className="mt-1">
                All interview times are displayed in {tzAbbreviation()}. Your profile timezone is {user.timezone}.
              </p>
            </CardBody>
          </Card>

          <Link
            href="/student/interviews"
            className="flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3 text-[12.5px] font-medium shadow-card hover:border-line-strong"
          >
            Need to change an existing booking?
            <ChevronRight className="size-4 text-muted" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
