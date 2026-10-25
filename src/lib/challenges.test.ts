import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CHALLENGES,
  CHALLENGE_TARGET_MAX,
  challengeFormProblem,
  challengeProgress,
  daysLeftInMonth,
  monthEnd,
  monthStart,
  nextMonthStart,
  rankClients,
  yesterdayInMonth,
} from "./challenges";

describe("built-in challenges", () => {
  it("has 20 with unique keys, all winnable in February", () => {
    expect(BUILT_IN_CHALLENGES).toHaveLength(20);
    expect(new Set(BUILT_IN_CHALLENGES.map((c) => c.key)).size).toBe(20);
    for (const c of BUILT_IN_CHALLENGES) {
      expect(c.target_days).toBeGreaterThan(0);
      expect(c.target_days).toBeLessThanOrEqual(CHALLENGE_TARGET_MAX);
      expect(challengeFormProblem(c)).toBeNull();
    }
  });

  it("never suggests oats", () => {
    expect(JSON.stringify(BUILT_IN_CHALLENGES).toLowerCase()).not.toMatch(/\boats?\b/);
  });
});

describe("month helpers", () => {
  it("works out the month", () => {
    expect(monthStart("2026-10-25")).toBe("2026-10-01");
    expect(nextMonthStart("2026-10-25")).toBe("2026-11-01");
    expect(nextMonthStart("2026-12-03")).toBe("2027-01-01");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(daysLeftInMonth("2026-10-25")).toBe(7);
    expect(yesterdayInMonth("2026-10-01")).toBeNull();
    expect(yesterdayInMonth("2026-10-10")).toBe("2026-10-09");
  });
});

describe("challengeProgress", () => {
  const ch = { month: "2026-10-01", target_days: 3 };
  it("counts this month's days up to today", () => {
    const p = challengeProgress(ch, ["2026-10-01", "2026-10-02", "2026-09-30", "2026-10-02"], "2026-10-02");
    expect(p).toMatchObject({ done: 2, won: false, doneToday: true, canStillWin: true });
  });
  it("wins at the target", () => {
    expect(challengeProgress(ch, ["2026-10-01", "2026-10-05", "2026-10-09"], "2026-10-09").won).toBe(true);
  });
  it("knows when it can't be won any more", () => {
    expect(challengeProgress({ month: "2026-10-01", target_days: 20 }, ["2026-10-01"], "2026-10-25").canStillWin).toBe(false);
  });
});

describe("rankClients", () => {
  it("puts the most days first and marks winners", () => {
    const rows = rankClients(
      [
        { id: "a", name: "Nancy" },
        { id: "b", name: "Ben" },
        { id: "c", name: "Ali" },
      ],
      [
        { client_id: "b", day: "2026-10-01" },
        { client_id: "b", day: "2026-10-02" },
        { client_id: "a", day: "2026-10-01" },
      ],
      2
    );
    expect(rows.map((r) => [r.name, r.done, r.won])).toEqual([
      ["Ben", 2, true],
      ["Nancy", 1, false],
      ["Ali", 0, false],
    ]);
  });
});

describe("challengeFormProblem", () => {
  const ok = { title: "Stairs", daily_task: "Take the stairs", summary: "", target_days: 20 };
  it("checks the owner's form", () => {
    expect(challengeFormProblem(ok)).toBeNull();
    expect(challengeFormProblem({ ...ok, title: " " })).toMatch(/name/);
    expect(challengeFormProblem({ ...ok, target_days: 30 })).toMatch(/February/);
    expect(challengeFormProblem({ ...ok, summary: "Have oats for breakfast" })).toMatch(/oats/);
  });
});
