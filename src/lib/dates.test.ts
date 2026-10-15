import { afterEach, describe, expect, it } from "vitest";
import { describeTimeSince, parseIsoDate, startOfLocalDay, toIsoDate, todayIso } from "@/lib/dates";

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

describe("describeTimeSince", () => {
  const now = new Date(2026, 9, 9, 13, 0);
  const since = (y: number, m: number, d: number, h = 9) => describeTimeSince(new Date(y, m - 1, d, h), now);

  it("counts calendar days, not 24-hour blocks", () => {
    expect(since(2026, 10, 9, 8)).toBe("Joined today");
    expect(since(2026, 10, 8, 23)).toBe("1 day");
    expect(since(2026, 9, 30)).toBe("9 days");
  });

  it("switches to weeks, then months, then years", () => {
    expect(since(2026, 9, 25)).toBe("2 weeks");
    expect(since(2026, 8, 20)).toBe("7 weeks");
    expect(since(2026, 8, 9)).toBe("2 months");
    expect(since(2026, 8, 10)).toBe("8 weeks");
    expect(since(2025, 11, 9)).toBe("11 months");
    expect(since(2025, 10, 9)).toBe("1 year");
    expect(since(2024, 7, 1)).toBe("2 years 3 months");
  });
});
