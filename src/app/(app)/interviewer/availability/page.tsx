import {
  Ban,
  CalendarPlus,
  Clock,
  Info,
  Lock,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { requireInterviewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createAvailabilityAction,
  deleteAvailabilityAction,
  toggleAvailabilityAction,
  updateAvailabilityAction,
} from "@/app/actions/interviewer";
import { ActionForm, Modal } from "@/components/action-form";
import {
  Badge,
  buttonClasses,
  Card,
  CardHeader,
  EmptyState,
  Field,
  InfoBanner,
  PageHeader,
  StatusPill,
  inputClasses,
  selectClasses,
} from "@/components/ui";
import { dateKeyInTz, formatDate, formatDayLabel, tzAbbreviation } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Availability" };

function AvailabilityFields({
  prefix,
  values,
  todayKey,
}: {
  prefix: string;
  values?: {
    dateKey: string;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    breakStart: string | null;
    breakEnd: string | null;
    note: string | null;
  };
  todayKey: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" htmlFor={`${prefix}-date`}>
          <input
            id={`${prefix}-date`}
            type="date"
            name="dateKey"
            required
            min={todayKey}
            defaultValue={values?.dateKey ?? todayKey}
            className={inputClasses}
          />
        </Field>
        <Field label="Start time" htmlFor={`${prefix}-start`}>
          <input
            id={`${prefix}-start`}
            type="time"
            name="startTime"
            required
            defaultValue={values?.startTime ?? "09:00"}
            className={inputClasses}
          />
        </Field>
        <Field label="End time" htmlFor={`${prefix}-end`}>
          <input
            id={`${prefix}-end`}
            type="time"
            name="endTime"
            required
            defaultValue={values?.endTime ?? "12:30"}
            className={inputClasses}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Interview length" htmlFor={`${prefix}-length`} hint="Slot length in minutes">
          <select
            id={`${prefix}-length`}
            name="slotMinutes"
            defaultValue={String(values?.slotMinutes ?? 45)}
            className={selectClasses}
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </select>
        </Field>
        <Field label="Break start" htmlFor={`${prefix}-break-start`} hint="Optional">
          <input
            id={`${prefix}-break-start`}
            type="time"
            name="breakStart"
            defaultValue={values?.breakStart ?? ""}
            className={inputClasses}
          />
        </Field>
        <Field label="Break end" htmlFor={`${prefix}-break-end`} hint="Optional">
          <input
            id={`${prefix}-break-end`}
            type="time"
            name="breakEnd"
            defaultValue={values?.breakEnd ?? ""}
            className={inputClasses}
          />
        </Field>
      </div>
      <Field label="Internal note" htmlFor={`${prefix}-note`} hint="Visible only to you and interview operations">
        <input
          id={`${prefix}-note`}
          type="text"
          name="note"
          maxLength={200}
          defaultValue={values?.note ?? ""}
          placeholder="e.g. Focus block for technical interviews"
          className={inputClasses}
        />
      </Field>
    </div>
  );
}

export default async function AvailabilityPage() {
  const user = await requireInterviewer();
  const now = new Date();
  const todayKey = dateKeyInTz(now);

  const windows = await prisma.interviewerAvailability.findMany({
    where: {
      interviewerId: user.interviewerId,
      date: { gte: new Date(`${todayKey}T00:00:00.000Z`) },
    },
    include: {
      slots: { select: { id: true, status: true, startsAt: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const upcoming = windows.filter((window) => window.status === "ACTIVE");
  const blocked = windows.filter((window) => window.status === "BLOCKED");
  const totalOpen = windows
    .flatMap((window) => window.slots)
    .filter((slot) => slot.status === "OPEN" && slot.startsAt > now).length;
  const totalBooked = windows
    .flatMap((window) => window.slots)
    .filter((slot) => slot.status === "BOOKED").length;

  return (
    <div>
      <PageHeader
        eyebrow="Interviewer · Availability"
        title="Availability"
        description={`Publish when students can book you. All windows use ${tzAbbreviation()}.`}
        actions={
          <Modal
            title="Add availability"
            description="Slots are generated automatically, split around your break and excluding past times."
            trigger={
              <>
                <Plus className="size-3.5" /> Add window
              </>
            }
            triggerClassName="bg-accent text-white border-accent hover:bg-accent-hover"
          >
            <ActionForm action={createAvailabilityAction} successMessage="Availability published" className="space-y-4">
              <AvailabilityFields prefix="create" todayKey={todayKey} />
              <p className="rounded-lg bg-[#fafaf7] px-3 py-2 text-[11.5px] leading-5 text-muted">
                Overlapping active windows are rejected. Blocking a window withdraws its open slots immediately.
              </p>
              <button type="submit" className={buttonClasses("primary", "md", "w-full")}>
                <CalendarPlus className="size-4" /> Publish availability
              </button>
            </ActionForm>
          </Modal>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Open slots</p>
          <p className="mt-1 text-[24px] font-semibold tabular">{totalOpen}</p>
          <p className="text-[11.5px] text-muted">Bookable by students</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Booked</p>
          <p className="mt-1 text-[24px] font-semibold tabular">{totalBooked}</p>
          <p className="text-[11.5px] text-muted">Confirmed interviews</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Windows</p>
          <p className="mt-1 text-[24px] font-semibold tabular">
            {upcoming.length} <span className="text-[14px] font-normal text-muted">active</span>
          </p>
          <p className="text-[11.5px] text-muted">{blocked.length} blocked</p>
        </Card>
      </div>

      {blocked.length > 0 ? (
        <div className="mb-5">
          <InfoBanner tone="warn" title={`${blocked.length} blocked window${blocked.length === 1 ? "" : "s"}`}>
            Blocked windows do not accept new bookings. If a confirmed interview falls inside a blocked window,
            interview operations must reassign it before the window can be deleted.
          </InfoBanner>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Published windows"
          description="Upcoming availability and the slots generated from each window."
          action={<Badge tone="neutral">{windows.length} total</Badge>}
        />
        {windows.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus className="size-4" />}
            title="No availability published"
            description="Add a window to let students book interviews with you."
          />
        ) : (
          <ul className="divide-y divide-line">
            {windows.map((window) => {
              const key = window.date.toISOString().slice(0, 10);
              const openCount = window.slots.filter((slot) => slot.status === "OPEN" && slot.startsAt > now).length;
              const bookedCount = window.slots.filter((slot) => slot.status === "BOOKED").length;
              const cancelledCount = window.slots.filter((slot) => slot.status === "CANCELLED").length;
              const isBlocked = window.status === "BLOCKED";
              return (
                <li key={window.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold">
                          {formatDayLabel(new Date(`${key}T00:00:00.000Z`))} · {formatDate(new Date(`${key}T00:00:00.000Z`))}
                        </p>
                        <StatusPill value={window.status} />
                        {bookedCount > 0 ? <Badge tone="warn">{bookedCount} booked</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {window.startTime}–{window.endTime} · {window.slotMinutes} minute slots
                        {window.breakStart && window.breakEnd
                          ? ` · break ${window.breakStart}–${window.breakEnd}`
                          : ""}
                      </p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {openCount} open · {bookedCount} booked
                        {cancelledCount > 0 ? ` · ${cancelledCount} withdrawn` : ""}
                        {window.note ? ` · ${window.note}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {bookedCount === 0 ? (
                        <Modal
                          title="Edit availability"
                          description="Slots are regenerated for the new window. Existing open slots are replaced."
                          trigger={
                            <>
                              <Pencil className="size-3.5" /> Edit
                            </>
                          }
                        >
                          <ActionForm
                            action={updateAvailabilityAction}
                            successMessage="Availability updated"
                            className="space-y-4"
                          >
                            <input type="hidden" name="availabilityId" value={window.id} />
                            <AvailabilityFields
                              prefix={`edit-${window.id}`}
                              todayKey={todayKey}
                              values={{
                                dateKey: key,
                                startTime: window.startTime,
                                endTime: window.endTime,
                                slotMinutes: window.slotMinutes,
                                breakStart: window.breakStart,
                                breakEnd: window.breakEnd,
                                note: window.note,
                              }}
                            />
                            <button type="submit" className={buttonClasses("primary", "md", "w-full")}>
                              Save window
                            </button>
                          </ActionForm>
                        </Modal>
                      ) : (
                        <span
                          className={cn(buttonClasses("outline", "sm"), "cursor-not-allowed opacity-50")}
                          title="Interviews are already booked in this window"
                        >
                          <Lock className="size-3.5" /> Edit
                        </span>
                      )}

                      <Modal
                        title={isBlocked ? "Reopen availability" : "Block availability"}
                        description={
                          isBlocked
                            ? "Open slots are regenerated for future times and students can book again."
                            : "Open slots are withdrawn immediately. Confirmed interviews are preserved and flagged for operations."
                        }
                        trigger={
                          isBlocked ? (
                            <>
                              <PlayCircle className="size-3.5" /> Reopen
                            </>
                          ) : (
                            <>
                              <Ban className="size-3.5" /> Block
                            </>
                          )
                        }
                      >
                        <ActionForm
                          action={toggleAvailabilityAction}
                          successMessage={isBlocked ? "Availability reopened" : "Availability blocked"}
                          className="space-y-4"
                        >
                          <input type="hidden" name="availabilityId" value={window.id} />
                          <input type="hidden" name="blocked" value={isBlocked ? "false" : "true"} />
                          <div className="text-[12.5px] leading-6 text-ink-soft">
                            {isBlocked
                              ? "Reopening restores future open slots. Confirmed interviews stay booked."
                              : bookedCount > 0
                                ? `This window contains ${bookedCount} confirmed interview${bookedCount === 1 ? "" : "s"}. Blocking withdraws the remaining open slots and puts the confirmed interviews in the operations reassignment queue.`
                                : "No interviews are booked in this window. Blocking withdraws all future open slots."}
                          </div>
                          <button
                            type="submit"
                            className={buttonClasses(isBlocked ? "primary" : "danger", "md", "w-full")}
                          >
                            {isBlocked ? "Reopen availability" : "Block this window"}
                          </button>
                        </ActionForm>
                      </Modal>

                      {bookedCount === 0 ? (
                        <Modal
                          title="Delete availability"
                          description="This permanently removes the window and any open slots."
                          trigger={
                            <>
                              <Trash2 className="size-3.5" /> Delete
                            </>
                          }
                          triggerClassName="text-bad"
                        >
                          <ActionForm
                            action={deleteAvailabilityAction}
                            successMessage="Availability window deleted"
                            className="space-y-4"
                          >
                            <input type="hidden" name="availabilityId" value={window.id} />
                            <p className="text-[12.5px] leading-6 text-ink-soft">
                              The {window.startTime}–{window.endTime} window on {formatDate(window.date)} will be
                              removed. This cannot be undone.
                            </p>
                            <button type="submit" className={buttonClasses("danger", "md", "w-full")}>
                              Delete window
                            </button>
                          </ActionForm>
                        </Modal>
                      ) : (
                        <span
                          className={cn(buttonClasses("outline", "sm"), "cursor-not-allowed opacity-50")}
                          title="Reassign the booked interviews first"
                        >
                          <Lock className="size-3.5" /> Delete
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-card border border-line bg-surface px-4 py-3 text-[11.5px] leading-5 text-muted shadow-card">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted" />
        <p>
          Windows cannot overlap. A window with confirmed interviews cannot be edited or deleted until interview
          operations reassigns those interviews. Withdrawing availability does not erase booking history.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11.5px] text-muted">
        <Clock className="size-3.5" /> Times are shown in {tzAbbreviation()}.
      </div>
    </div>
  );
}
