import { describe, expect, it } from "vitest";
import { findImprovements, sessionStatus } from "./workoutSessions";

const set = (log_date: string, weight_kg: number | null, reps: number, name = "Squat", exercise_id: string | null = "sq") => ({
  log_date,
  weight_kg,
  reps,
  exercise_name: name,
  exercise_id,
});

describe("sessionStatus", () => {
  it("is complete only when every planned set is done", () => {
    expect(sessionStatus(18, 18)).toBe("complete");
    expect(sessionStatus(20, 18)).toBe("complete");
    expect(sessionStatus(12, 18)).toBe("partial");
    expect(sessionStatus(0, 0)).toBe("partial");
  });
});

describe("findImprovements", () => {
  it("stars a heavier top weight", () => {
    const today = [set("2026-10-12", 65, 8), set("2026-10-12", 65, 8)];
    const earlier = [set("2026-10-05", 60, 10), set("2026-10-05", 60, 10)];
    expect(findImprovements(today, earlier)).toEqual([{ exercise: "Squat", before: "60kg × 10", after: "65kg × 8" }]);
  });

  it("stars more reps at the same weight", () => {
    const today = [set("2026-10-12", 60, 10), set("2026-10-12", 60, 9)];
    const earlier = [set("2026-10-05", 60, 9), set("2026-10-05", 60, 8)];
    expect(findImprovements(today, earlier)).toHaveLength(1);
  });

  it("only compares with the latest earlier day", () => {
    const today = [set("2026-10-12", 60, 10)];
    const earlier = [set("2026-09-01", 50, 10), set("2026-10-05", 62.5, 10)];
    expect(findImprovements(today, earlier)).toEqual([]);
  });

  it("does nothing the first time or when it went down", () => {
    expect(findImprovements([set("2026-10-12", 60, 10)], [])).toEqual([]);
    expect(findImprovements([set("2026-10-12", 55, 12)], [set("2026-10-05", 60, 8)])).toEqual([]);
  });

  it("counts reps for bodyweight work and matches by name without an id", () => {
    const today = [set("2026-10-12", null, 12, "Push ups", null)];
    const earlier = [set("2026-10-05", null, 10, "Push ups", null)];
    expect(findImprovements(today, earlier)).toEqual([{ exercise: "Push ups", before: "10 reps", after: "12 reps" }]);
  });
});

describe("findImprovements with warm-ups", () => {
  it("ignores warm-up sets", () => {
    const set = (log_date: string, weight_kg: number, warm_up = false) => ({
      exercise_id: "e1",
      exercise_name: "Bench",
      weight_kg,
      reps: 8,
      log_date,
      warm_up,
    });
    // A heavy warm-up last time doesn't hide today's progress, and today's warm-up isn't counted.
    expect(findImprovements([set("2026-10-12", 20, true), set("2026-10-12", 42.5)], [set("2026-10-05", 50, true), set("2026-10-05", 40)])).toHaveLength(1);
    expect(findImprovements([set("2026-10-12", 60, true), set("2026-10-12", 40)], [set("2026-10-05", 40)])).toHaveLength(0);
  });
});
