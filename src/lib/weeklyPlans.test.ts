import { describe, expect, it } from "vitest";
import { firstWeekEnd, nextPlanWeek, planEnd, planSessionsBetween, planWeekOf } from "./weeklyPlans";

// Monday 19 October 2026, Mon/Wed/Fri, 3 weeks.
const plan = { start_date: "2026-10-19", split_days: [1, 3, 5], weeks: 3, placed_until: "2026-10-25" };

describe("weekly plans", () => {
  it("runs weeks of 7 days from the start", () => {
    expect(planEnd(plan)).toBe("2026-11-08");
    expect(firstWeekEnd(plan)).toBe("2026-10-25");
    expect(planWeekOf(plan, "2026-10-25")).toBe(1);
    expect(planWeekOf(plan, "2026-10-26")).toBe(2);
  });

  it("adds the next week until the plan ends", () => {
    expect(nextPlanWeek(plan)).toEqual({ from: "2026-10-26", to: "2026-11-01", week: 2 });
    expect(nextPlanWeek({ ...plan, placed_until: "2026-11-01" })).toEqual({ from: "2026-11-02", to: "2026-11-08", week: 3 });
    expect(nextPlanWeek({ ...plan, placed_until: "2026-11-08" })).toBeNull();
  });

  it("carries the program's sessions on in order into the next week", () => {
    const slots = [1, 2, 4, 5];
    expect(planSessionsBetween(plan, slots, "2026-10-26", "2026-11-01")).toEqual([
      { date: "2026-10-26", slot: 5 },
      { date: "2026-10-28", slot: 1 },
      { date: "2026-10-30", slot: 2 },
    ]);
  });

  it("keeps a one-week plan to its own week", () => {
    expect(firstWeekEnd({ start_date: "2026-10-21", weeks: 1 })).toBe("2026-10-27");
  });
});
