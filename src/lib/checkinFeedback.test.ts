import { describe, expect, it } from "vitest";
import { checkinFeedback, sleepHours } from "./checkinFeedback";

const day = (date: string, over: Partial<Parameters<typeof checkinFeedback>[0][number]> = {}) => ({
  checkin_date: date,
  alcohol_units: 0,
  sleep_bed_time: "22:00",
  sleep_wake_time: "06:00",
  sleep_quality: 4 as const,
  water_litres: 3,
  meals_total: 4,
  high_gi_count: 0,
  wound_down: true,
  fatigue_status: "ok" as const,
  pain_status: "ok" as const,
  mental_status: "ok" as const,
  ...over,
});

describe("sleepHours", () => {
  it("handles going to bed before midnight", () => {
    expect(sleepHours("22:30", "06:00")).toBe(7.5);
    expect(sleepHours("00:30", "07:00")).toBe(6.5);
  });
  it("ignores missing or silly times", () => {
    expect(sleepHours(null, "06:00")).toBeNull();
    expect(sleepHours("06:00", "06:30")).toBeNull();
  });
});

describe("checkinFeedback", () => {
  it("gives no tips and a win when everything is on track", () => {
    const week = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"].map((d) => day(d));
    const fb = checkinFeedback(week, "2026-10-12");
    expect(fb.tips).toHaveLength(0);
    expect(fb.win).toMatch(/checked in 7 days/);
  });

  it("flags short sleep, low water and heavy drinking, most important first, at most 3", () => {
    const week = ["2026-10-10", "2026-10-11", "2026-10-12"].map((d) =>
      day(d, { sleep_bed_time: "00:30", sleep_wake_time: "05:30", water_litres: 1, alcohol_units: 5, high_gi_count: 3 }),
    );
    const fb = checkinFeedback(week, "2026-10-12");
    expect(fb.tips).toHaveLength(3);
    expect(fb.tips[0].key).toBe("sleep");
    expect(fb.tips.map((t) => t.key)).toEqual(expect.arrayContaining(["alcohol"]));
    for (const t of fb.tips) expect(t.itWill.length).toBeGreaterThan(10);
  });

  it("puts pain first and only uses the last 7 days", () => {
    const fb = checkinFeedback(
      [day("2026-10-12", { pain_status: "reported" }), day("2026-09-01", { water_litres: 0.5 })],
      "2026-10-12",
    );
    expect(fb.days).toBe(1);
    expect(fb.tips.map((t) => t.key)).toEqual(["pain"]);
  });

  it("never suggests oats", () => {
    const fb = checkinFeedback([day("2026-10-12", { high_gi_count: 4, meals_total: 1 })], "2026-10-12");
    expect(JSON.stringify(fb).toLowerCase()).not.toMatch(/\boats?\b/);
  });
});
