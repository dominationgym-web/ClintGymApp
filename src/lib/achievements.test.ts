import { describe, expect, it } from "vitest";
import { achievementBaseline, earnsAchievement, percentUp } from "./achievements";

const set = (weight_kg: number | null, reps: number, log_date: string, warm_up = false) => ({ weight_kg, reps, log_date, warm_up });

describe("achievementBaseline", () => {
  it("starts from the first day's heaviest set, ignoring warm-ups", () => {
    const b = achievementBaseline([set(30, 20, "2026-10-01", true), set(50, 10, "2026-10-01"), set(50, 8, "2026-10-01"), set(45, 12, "2026-10-01")], null);
    expect(b).toEqual({ weight: 50, reps: 10, date: "2026-10-01" });
  });

  it("counts from the last badge once there is one", () => {
    expect(achievementBaseline([set(50, 10, "2026-10-01")], { weight: 55, reps: 10, achieved_on: "2026-10-08" })).toEqual({
      weight: 55,
      reps: 10,
      date: "2026-10-08",
    });
  });

  it("has no baseline for bodyweight work", () => {
    expect(achievementBaseline([set(null, 15, "2026-10-01")], null)).toBeNull();
  });
});

describe("earnsAchievement", () => {
  const base = { weight: 50, reps: 10, date: "2026-10-01" };
  it("needs 10% more weight for at least the same reps", () => {
    expect(earnsAchievement(set(55, 10, "2026-10-08"), base)).toBe(true);
    expect(earnsAchievement(set(55, 12, "2026-10-08"), base)).toBe(true);
    expect(earnsAchievement(set(52.5, 10, "2026-10-08"), base)).toBe(false);
    expect(earnsAchievement(set(55, 8, "2026-10-08"), base)).toBe(false);
  });

  it("never on the baseline's own day, a warm-up, or without a baseline", () => {
    expect(earnsAchievement(set(60, 10, "2026-10-01"), base)).toBe(false);
    expect(earnsAchievement(set(60, 10, "2026-10-08", true), base)).toBe(false);
    expect(earnsAchievement(set(60, 10, "2026-10-08"), null)).toBe(false);
  });

  it("works out the percentage", () => {
    expect(percentUp(50, 55)).toBe(10);
  });
});
