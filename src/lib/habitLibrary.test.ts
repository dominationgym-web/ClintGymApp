import { describe, expect, it } from "vitest";
import { findHabit, HABIT_GROUPS, isRunning } from "./habitLibrary";

describe("HABIT_GROUPS", () => {
  const all = HABIT_GROUPS.flatMap((g) => g.habits);
  it("has unique names that fit the 60-character limit and 1-10 reps", () => {
    expect(new Set(all.map((h) => h.name.toLowerCase())).size).toBe(all.length);
    for (const h of all) {
      expect(h.name.length).toBeLessThanOrEqual(60);
      expect(h.reps).toBeGreaterThanOrEqual(1);
      expect(h.reps).toBeLessThanOrEqual(10);
    }
  });
  it("never mentions oats", () => {
    expect(JSON.stringify(HABIT_GROUPS).toLowerCase()).not.toContain("oat");
  });
});

describe("isRunning", () => {
  it("is running with no end date or one that hasn't passed", () => {
    expect(isRunning({ end_date: null }, "2026-10-11")).toBe(true);
    expect(isRunning({ end_date: "2026-10-11" }, "2026-10-11")).toBe(true);
    expect(isRunning({ end_date: "2026-10-10" }, "2026-10-11")).toBe(false);
  });
});

describe("findHabit", () => {
  it("matches names ignoring case and spaces", () => {
    expect(findHabit([{ name: "Walk 8,000 steps " }], "walk 8,000 steps")).toBeTruthy();
    expect(findHabit([{ name: "Read 10 pages" }], "Read")).toBeUndefined();
  });
});
