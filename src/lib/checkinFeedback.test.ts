import { describe, expect, it } from "vitest";
import { alcoholMessage, checkinFeedback, EVOLVE_TAGLINE, sleepHours, waterTargetLitres } from "./checkinFeedback";

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

  it("shows the alcohol message instead of an alcohol tip", () => {
    const fb = checkinFeedback([day("2026-10-11", { alcohol_units: 6 }), day("2026-10-12", { alcohol_units: 4 })], "2026-10-12");
    expect(fb.tips.map((t) => t.key)).not.toContain("alcohol");
    expect(fb.alcohol?.kind).toBe("session");
  });

  it("flags short sleep, low water and heavy drinking, most important first, at most 3", () => {
    const week = ["2026-10-10", "2026-10-11", "2026-10-12"].map((d) =>
      day(d, { sleep_bed_time: "00:30", sleep_wake_time: "05:30", water_litres: 1, alcohol_units: 5, high_gi_count: 3 }),
    );
    const fb = checkinFeedback(week, "2026-10-12");
    expect(fb.tips).toHaveLength(3);
    expect(fb.tips[0].key).toBe("sleep");
    expect(fb.alcohol?.kind).toBe("session");
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

  it("sets the water target from body weight (nutrition review, 2026-10-18)", () => {
    expect(waterTargetLitres(55)).toBe(1.8);
    expect(waterTargetLitres(90)).toBe(3);
    expect(waterTargetLitres(null)).toBe(2);
    const week = (litres: number) => ["2026-10-10", "2026-10-11", "2026-10-12"].map((d) => day(d, { water_litres: litres }));
    expect(checkinFeedback(week(1.8), "2026-10-12", 55).tips.map((t) => t.key)).not.toContain("water");
    expect(checkinFeedback(week(2.5), "2026-10-12", 90).tips.map((t) => t.key)).toContain("water");
  });

  it("doesn't offer white rice as the low-GI swap or blame insulin", () => {
    const tip = checkinFeedback([day("2026-10-12", { high_gi_count: 4 })], "2026-10-12").tips.find((t) => t.key === "highGi")!;
    expect(tip.doThis).not.toMatch(/sweet potato, rice/);
    expect(tip.doThis).toMatch(/basmati or brown rice/);
    expect(tip.itWill).not.toMatch(/insulin/i);
  });

  it("never suggests oats", () => {
    const fb = checkinFeedback([day("2026-10-12", { high_gi_count: 4, meals_total: 1 })], "2026-10-12");
    expect(JSON.stringify(fb).toLowerCase()).not.toMatch(/\boats?\b/);
  });
});

describe("alcoholMessage", () => {
  const a = (date: string, alcohol_units: number) => ({ checkin_date: date, alcohol_units });
  const once = (text: string) => expect(text.split(EVOLVE_TAGLINE)).toHaveLength(2);
  // Sat 10, Sun 11 heavy; Mon 12 checks in about Sunday.
  const weekend = [a("2026-10-09", 0), a("2026-10-10", 5), a("2026-10-11", 6), a("2026-10-12", 3)];

  it("after a heavy weekend, asks to limit it and gives recovery advice", () => {
    const m = alcoholMessage(weekend, "2026-10-12")!;
    expect(m.kind).toBe("session");
    expect(m.title).toMatch(/limit/);
    expect(m.text).toMatch(/sleep/);
    expect(m.text).toMatch(/water/);
    expect(m.text).toMatch(/electrolytes/);
    expect(m.text).toMatch(/honest/);
    once(m.text);
  });

  it("praises the first alcohol-free day with benefits", () => {
    const m = alcoholMessage([...weekend, a("2026-10-13", 0)], "2026-10-13")!;
    expect(m.kind).toBe("firstDry");
    expect(m.text).toMatch(/Well done/);
    once(m.text);
  });

  it("counts the streak and rotates the benefit", () => {
    const d4 = [...weekend, a("2026-10-13", 0), a("2026-10-14", 0), a("2026-10-15", 0), a("2026-10-16", 0)];
    const m4 = alcoholMessage(d4, "2026-10-16")!;
    const m3 = alcoholMessage(d4, "2026-10-15")!;
    expect(m4.kind).toBe("dryStreak");
    expect(m4.text).toMatch(/^4 days alcohol-free/);
    expect(m4.text).not.toBe(m3.text.replace("3 days", "4 days"));
    once(m4.text);
  });

  it("is disappointed but kind when they drink after a 5-day streak", () => {
    const rows = [a("2026-10-05", 6), ...["06", "07", "08", "09", "10"].map((d) => a(`2026-10-${d}`, 0)), a("2026-10-11", 5)];
    const m = alcoholMessage(rows, "2026-10-11")!;
    expect(m.kind).toBe("slipped");
    expect(m.text).toMatch(/You were doing so well, 5 days alcohol-free/);
    expect(m.text).toMatch(/tomorrow/);
    expect(m.text).toMatch(/electrolytes/);
    once(m.text);
  });

  it("gives a short positive note when they never drink", () => {
    const m = alcoholMessage(["10", "11", "12", "13"].map((d) => a(`2026-10-${d}`, 0)), "2026-10-13")!;
    expect(m.kind).toBe("neverDrinks");
    expect(m.text).not.toMatch(/limit|electrolytes/);
    once(m.text);
  });

  it("never uses em-dashes or mentions oats", () => {
    const texts = [weekend, [...weekend, a("2026-10-13", 0)]].map((r) => alcoholMessage(r, "2026-10-16")!.text);
    for (const t of texts) expect(t).not.toMatch(/\u2014|oat/i);
  });
});
