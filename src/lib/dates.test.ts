import { afterEach, describe, expect, it } from "vitest";
import { parseIsoDate, startOfLocalDay, toIsoDate, todayIso } from "@/lib/dates";

const originalTz = process.env.TZ;

function withTimezone(tz: string, run: () => void) {
  process.env.TZ = tz;
  run();
}

afterEach(() => {
  process.env.TZ = originalTz;
});

// Africa/Johannesburg is UTC+2 and is where the clients are; Pacific/Kiritimati
// is UTC+14, the worst case. Both are ahead of UTC, which is what broke the
// old `toISOString().slice(0, 10)` approach. America/New_York is behind UTC,
// where that bug stayed hidden.
const TIMEZONES = ["UTC", "Africa/Johannesburg", "Pacific/Kiritimati", "America/New_York"];

describe("toIsoDate", () => {
  it.each(TIMEZONES)("gives the local calendar date in %s", (tz) => {
    withTimezone(tz, () => {
      expect(toIsoDate(new Date(2026, 8, 21, 0, 0, 0))).toBe("2026-09-21");
      expect(toIsoDate(new Date(2026, 8, 21, 23, 59, 59))).toBe("2026-09-21");
    });
  });

  it("pads single-digit months and days", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("todayIso", () => {
  it.each(TIMEZONES)("matches the local date at midnight in %s", (tz) => {
    withTimezone(tz, () => {
      // The moment the old implementation got wrong: just after local midnight.
      const justAfterMidnight = startOfLocalDay(new Date());
      justAfterMidnight.setMinutes(1);
      expect(toIsoDate(justAfterMidnight)).toBe(todayIso());
    });
  });
});

describe("parseIsoDate", () => {
  it.each(TIMEZONES)("round-trips a calendar date in %s", (tz) => {
    withTimezone(tz, () => {
      expect(toIsoDate(parseIsoDate("2026-09-21"))).toBe("2026-09-21");
    });
  });

  it("parses to local midnight, not UTC midnight", () => {
    const parsed = parseIsoDate("2026-09-21");
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getDate()).toBe(21);
  });
});

describe("startOfLocalDay", () => {
  it("zeroes the time without moving the date", () => {
    const start = startOfLocalDay(new Date(2026, 8, 21, 17, 42, 9, 500));
    expect(toIsoDate(start)).toBe("2026-09-21");
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });
});
