import { describe, expect, it } from "vitest";
import { deloadExercises, deloadStartChoices, deloadSuggestion, deloadWeight, nextMonday } from "./deload";

describe("deload", () => {
  it("halves the sets on strength exercises and keeps cardio", () => {
    const rows = deloadExercises([
      { sets: 4, kind: "exercise" as const },
      { sets: 3, kind: "exercise" as const },
      { sets: 1, kind: "exercise" as const },
      { sets: 1, kind: "cardio" as const },
    ]);
    expect(rows.map((r) => r.sets)).toEqual([2, 2, 1, 1]);
  });

  it("uses about 70% of the weight, on the exercise's weight step", () => {
    expect(deloadWeight(100, { name: "Barbell Back Squat", category: "Legs" })).toBe(70);
    expect(deloadWeight(40, { name: "Dumbbell Press", category: "Chest" })).toBe(27.5);
    expect(deloadWeight(2, { name: "Lateral Raise", category: "Shoulders" })).toBe(2.5);
  });

  it("turns the usual suggestion into the deload weight", () => {
    const s = deloadSuggestion({ last: "Last time: 60kg × 10, 10", advice: "Try 62.5kg", weight: 62.5 }, { name: "Bench Press", category: "Chest" });
    expect(s?.weight).toBe(40);
    expect(s?.advice).toContain("Deload week");
    expect(deloadSuggestion(null, { name: "x", category: null })).toBeNull();
  });

  it("picks the next Monday", () => {
    expect(nextMonday("2026-10-18")).toBe("2026-10-19"); // Sunday
    expect(nextMonday("2026-10-19")).toBe("2026-10-26"); // Monday
    expect(nextMonday("2026-10-21")).toBe("2026-10-26"); // Wednesday
    const choices = deloadStartChoices("2026-10-21");
    expect(choices.map((c) => c.date)).toEqual(["2026-10-26", "2026-11-02", "2026-10-22"]);
    expect(deloadStartChoices("2026-10-18").map((c) => c.date)).toEqual(["2026-10-19", "2026-10-26"]);
  });
});
