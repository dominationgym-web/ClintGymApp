import { describe, expect, it } from "vitest";
import { compareMonths, habitSeries, habitValue, HABITS, monthlyStats, type MonthlyRow } from "./checkinMonthly";

const row = (date: string, over: Partial<MonthlyRow> = {}): MonthlyRow => ({
  checkin_date: date,
  alcohol_units: 0,
  water_litres: 2.5,
  sleep_bed_time: "22:00",
  sleep_asleep_time: null,
  sleep_wake_time: "06:00",
  sleep_quality: 4,
  high_gi_count: 0,
  wound_down: true,
  pain_status: "ok",
  fatigue_status: "ok",
  mental_status: "ok",
  ...over,
});

const rows = [
  row("2026-09-02", { alcohol_units: 4, water_litres: 1 }),
  row("2026-09-05", { alcohol_units: 2 }),
  row("2026-09-09", { fatigue_status: "reported", sleep_wake_time: "05:00" }),
  row("2026-10-01", { alcohol_units: 3 }),
  row("2026-10-03", { pain_status: "reported", high_gi_count: 2 }),
  row("2026-10-08", { sleep_bed_time: null, sleep_quality: null }),
];

describe("monthlyStats", () => {
  it("counts each habit per month", () => {
    const [sep, oct] = monthlyStats(rows, 70);
    expect(sep.month).toBe("2026-09-01");
    expect(sep.values).toMatchObject({ checkins: 3, alcoholDays: 2, alcoholUnits: 6, waterDays: 2, sleepHours: 7.7, tiredDays: 1, painDays: 0 });
    expect(oct.values).toMatchObject({ checkins: 3, alcoholDays: 1, alcoholUnits: 3, waterDays: 3, sleepHours: 8, sleepQuality: 4, painDays: 1, highGi: 2 });
  });

  it("says which way each habit went against last month", () => {
    const [sep, oct] = monthlyStats(rows, 70);
    const c = compareMonths(oct, sep);
    const get = (k: string) => c.find((x) => x.habit.key === k)!;
    expect(get("alcoholDays")).toMatchObject({ now: 1, before: 2, change: -1, trend: "better" });
    expect(get("waterDays")).toMatchObject({ change: 1, trend: "better" });
    expect(get("painDays")).toMatchObject({ change: 1, trend: "worse" });
    expect(get("checkins").trend).toBe("same");
    expect(compareMonths(sep, null)[0].trend).toBeNull();
  });

  it("graphs one habit by month and words the numbers", () => {
    const months = monthlyStats(rows, 70);
    expect(habitSeries(months, "alcoholUnits")).toEqual([
      { date: "2026-09-01", value: 6 },
      { date: "2026-10-01", value: 3 },
    ]);
    const h = (k: string) => HABITS.find((x) => x.key === k)!;
    expect(habitValue(h("alcoholDays"), 1, 3)).toBe("1 of 3 days");
    expect(habitValue(h("sleepHours"), 6.5, 3)).toBe("6.5 h (aim 7)");
    expect(habitValue(h("alcoholUnits"), 3, 3)).toBe("3 units");
  });
});
