import { describe, expect, it } from "vitest";
import {
  SLOT_TIMES,
  canCancel,
  canJoin,
  checkinDay,
  groupByDay,
  isUpcoming,
  setupReady,
  splitWeeks,
  todaysCheckin,
  weekKey,
  whatsappDigits,
  whatsappLink,
} from "./videoCheckins";
import type { VideoCheckinSettings, VideoCheckinSlot } from "@/types/database";

// Local times, like the phone shows them. 2026-10-28 is a Wednesday.
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const iso = (d: Date) => d.toISOString();
const booking = (startsAt: Date, status: "requested" | "confirmed" | "declined" | "cancelled" = "confirmed", minutes = 20) => ({
  status,
  starts_at: iso(startsAt),
  minutes,
});

describe("video check-in times", () => {
  it("offers half-hour times from 05:00 to 21:30", () => {
    expect(SLOT_TIMES[0]).toBe("05:00");
    expect(SLOT_TIMES).toContain("17:30");
    expect(SLOT_TIMES[SLOT_TIMES.length - 1]).toBe("21:30");
  });

  it("names today and tomorrow", () => {
    const now = at(28, 9);
    expect(checkinDay(iso(at(28, 17)), now)).toBe("Today");
    expect(checkinDay(iso(at(29, 7)), now)).toBe("Tomorrow");
    expect(checkinDay(iso(at(31, 7)), now)).toBe("Sat 31 Oct");
  });

  it("splits open times into this week (to Sunday) and next week", () => {
    const now = at(28, 9);
    // Day 32 of October is Sunday 1 Nov; day 33 is next Monday.
    const rows = [{ starts_at: iso(at(29, 17)) }, { starts_at: iso(at(32, 10)) }, { starts_at: iso(at(33, 8)) }];
    const { thisWeek, nextWeek } = splitWeeks(rows, now);
    expect(thisWeek).toHaveLength(2);
    expect(nextWeek).toHaveLength(1);
  });

  it("groups times by day in order", () => {
    const now = at(28, 9);
    const groups = groupByDay([{ starts_at: iso(at(29, 18)) }, { starts_at: iso(at(28, 17)) }, { starts_at: iso(at(29, 7)) }], now);
    expect(groups.map((g) => [g.day, g.rows.length])).toEqual([
      ["Today", 1],
      ["Tomorrow", 2],
    ]);
  });

  it("keys a week by its Monday", () => {
    expect(weekKey(at(28, 17))).toBe("2026-10-26");
    expect(weekKey(at(26, 6))).toBe("2026-10-26");
    expect(weekKey(at(32, 20))).toBe("2026-10-26"); // Sunday 1 Nov
    expect(weekKey(at(33, 6))).toBe("2026-11-02");
  });
});

describe("a booking", () => {
  const now = at(28, 16, 50);
  it("is upcoming until its time is up", () => {
    expect(isUpcoming(booking(at(28, 17)), now)).toBe(true);
    expect(isUpcoming(booking(at(28, 16, 20)), now)).toBe(false);
    expect(isUpcoming(booking(at(28, 17), "cancelled"), now)).toBe(false);
  });

  it("shows the WhatsApp button from 15 minutes before, confirmed only", () => {
    expect(canJoin(booking(at(28, 17)), now)).toBe(true);
    expect(canJoin(booking(at(28, 17, 10)), now)).toBe(false);
    expect(canJoin(booking(at(28, 17), "requested"), now)).toBe(false);
  });

  it("can be cancelled until it starts", () => {
    expect(canCancel(booking(at(28, 17)), now)).toBe(true);
    expect(canCancel(booking(at(28, 16, 45)), now)).toBe(false);
  });

  it("finds today's confirmed check-in for the pop-up", () => {
    const rows = [booking(at(29, 9)), booking(at(28, 18)), booking(at(28, 17), "requested"), booking(at(28, 8))];
    expect(todaysCheckin(rows, now)?.starts_at).toBe(iso(at(28, 18)));
    expect(todaysCheckin([booking(at(29, 9))], now)).toBeNull();
  });
});

describe("WhatsApp", () => {
  it("turns a South African number into wa.me digits", () => {
    expect(whatsappDigits("082 123 4567")).toBe("27821234567");
    expect(whatsappDigits("+27 82 123 4567")).toBe("27821234567");
    expect(whatsappDigits("0044 7700 900123")).toBe("447700900123");
    expect(whatsappDigits("123")).toBeNull();
    expect(whatsappLink("082-123-4567")).toBe("https://wa.me/27821234567");
    expect(whatsappLink(null)).toBeNull();
  });

  it("is ready for bookings with a time, a number and not paused", () => {
    const settings = { whatsapp: "0821234567", paused: false } as VideoCheckinSettings;
    const slot = { active: true } as VideoCheckinSlot;
    expect(setupReady(settings, [slot])).toBe(true);
    expect(setupReady(settings, [])).toBe(false);
    expect(setupReady({ ...settings, paused: true }, [slot])).toBe(false);
    expect(setupReady({ ...settings, whatsapp: null }, [slot])).toBe(false);
    expect(setupReady(null, [slot])).toBe(false);
  });
});
