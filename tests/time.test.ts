import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSlotRange,
  dateKeyInTz,
  formatDate,
  formatDateTime,
  hoursUntil,
  minutesBetween,
  timeInTz,
  zonedDateTimeToUtc,
} from "@/lib/time";

describe("IST wall-clock conversion", () => {
  it("maps 09:00 IST to 03:30 UTC", () => {
    assert.equal(
      zonedDateTimeToUtc("2026-11-11", "09:00", "Asia/Kolkata").toISOString(),
      "2026-11-11T03:30:00.000Z",
    );
  });

  it("handles the day boundary in the application timezone", () => {
    assert.equal(dateKeyInTz(new Date("2026-11-11T18:29:00.000Z"), "Asia/Kolkata"), "2026-11-11");
    assert.equal(dateKeyInTz(new Date("2026-11-11T18:30:00.000Z"), "Asia/Kolkata"), "2026-11-12");
  });

  it("formats dates and times in IST regardless of the host timezone", () => {
    const instant = new Date("2026-11-11T03:30:00.000Z");
    assert.equal(formatDate(instant, "Asia/Kolkata"), "11 Nov 2026");
    assert.equal(timeInTz(instant, "Asia/Kolkata"), "09:00");
    assert.equal(formatDateTime(instant, "Asia/Kolkata"), "11 Nov 2026 · 09:00");
  });
});

describe("slot generation", () => {
  it("produces contiguous slots up to the window end", () => {
    const slots = buildSlotRange("2026-11-11", "09:00", "12:00", 45, null, null, "Asia/Kolkata");
    assert.equal(slots.length, 4);
    assert.equal(slots[0].startsAt.toISOString(), "2026-11-11T03:30:00.000Z");
    assert.equal(slots[0].endsAt.toISOString(), "2026-11-11T04:15:00.000Z");
    assert.equal(slots[3].endsAt.toISOString(), "2026-11-11T06:30:00.000Z");
  });

  it("skips any slot that overlaps a break", () => {
    const slots = buildSlotRange("2026-11-11", "09:00", "12:00", 45, "10:15", "10:45", "Asia/Kolkata");
    assert.deepEqual(
      slots.map((slot) => timeInTz(slot.startsAt, "Asia/Kolkata")),
      ["09:00", "11:15"],
    );
  });
});

describe("durations", () => {
  it("measures hours until an instant", () => {
    const now = new Date("2026-11-11T00:00:00.000Z");
    const later = new Date("2026-11-11T04:30:00.000Z");
    assert.equal(hoursUntil(later, now), 4.5);
    assert.equal(hoursUntil(now, later), -4.5);
  });

  it("measures minutes between instants", () => {
    assert.equal(minutesBetween(new Date("2026-11-11T00:00:00.000Z"), new Date("2026-11-11T01:00:00.000Z")), 60);
  });
});
