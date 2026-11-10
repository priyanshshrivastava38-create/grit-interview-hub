import { env } from "./env";

export const APP_TIMEZONE = env.appTimezone;

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Converts a wall-clock date/time in a timezone into the correct UTC instant. */
export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone = APP_TIMEZONE): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid date/time: ${dateKey} ${time}`);
  }
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  const settled = tzOffsetMs(new Date(utc), timeZone);
  if (settled !== offset) utc = guess - settled;
  return new Date(utc);
}

export function dateKeyInTz(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function timeInTz(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, timeZone = APP_TIMEZONE): string {
  return `${formatDate(date, timeZone)} · ${timeInTz(date, timeZone)}`;
}

export function formatDayLabel(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatLongDate(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function relativeTime(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < hour) return formatter.format(Math.round(diff / minute), "minute");
  if (abs < day) return formatter.format(Math.round(diff / hour), "hour");
  if (abs < 7 * day) return formatter.format(Math.round(diff / day), "day");
  return formatDate(date);
}

export function hoursUntil(date: Date, now = new Date()): number {
  return (date.getTime() - now.getTime()) / 3_600_000;
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function startOfTodayTz(timeZone = APP_TIMEZONE): Date {
  const key = dateKeyInTz(new Date(), timeZone);
  return zonedDateTimeToUtc(key, "00:00", timeZone);
}

export function buildSlotRange(
  dateKey: string,
  startTime: string,
  endTime: string,
  slotMinutes: number,
  breakStart?: string | null,
  breakEnd?: string | null,
  timeZone = APP_TIMEZONE,
): Array<{ startsAt: Date; endsAt: Date }> {
  const slots: Array<{ startsAt: Date; endsAt: Date }> = [];
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const breakFrom = breakStart ? toMinutes(breakStart) : null;
  const breakTo = breakEnd ? toMinutes(breakEnd) : null;

  for (let cursor = start; cursor + slotMinutes <= end; cursor += slotMinutes) {
    const overlapsBreak =
      breakFrom !== null && breakTo !== null && cursor < breakTo && cursor + slotMinutes > breakFrom;
    if (overlapsBreak) continue;
    const fromLabel = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
    const untilCursor = cursor + slotMinutes;
    const toLabel = `${String(Math.floor(untilCursor / 60)).padStart(2, "0")}:${String(untilCursor % 60).padStart(2, "0")}`;
    slots.push({
      startsAt: zonedDateTimeToUtc(dateKey, fromLabel, timeZone),
      endsAt: zonedDateTimeToUtc(dateKey, toLabel, timeZone),
    });
  }
  return slots;
}

export function tzAbbreviation(timeZone = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(
    new Date(),
  );
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}
