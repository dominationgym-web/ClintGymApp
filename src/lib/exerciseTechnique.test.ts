import { describe, expect, it } from "vitest";
import library from "./__fixtures__/exerciseLibrary.json";
import { ALL_TECHNIQUES, techniqueFor } from "./exerciseTechnique";

// The live exercise library on 2026-10-11 (name, body part).
const EXERCISES = library as [string, string][];

const pattern = (name: string, category: string) => techniqueFor(name, category)?.pattern;

describe("exercise technique guides", () => {
  it("gives every exercise in the library a guide matched by its name", () => {
    const unmatched = EXERCISES.filter(([name, category]) => category !== "Cardio" && techniqueFor(name, null) === null);
    expect(unmatched).toEqual([]);
  });

  it("picks the right movement for exercises that could be confused", () => {
    expect(pattern("Horizontal Leg Press Calf Press", "Calves")).toBe("Calf raise");
    expect(pattern("Seated Leg Curl", "Hamstrings")).toBe("Leg curl");
    expect(pattern("Barbell Spinal Jefferson Curl", "Mobility")).toBe("Jefferson curl");
    expect(pattern("Dumbbell Wrist Curl", "Forearms & Grip")).toBe("Forearm and grip");
    expect(pattern("Snatch Grip Deadlift", "Full Body")).toBe("Deadlift");
    expect(pattern("Tricep Kickback", "Triceps")).toBe("Triceps kickback");
    expect(pattern("Cable Kickback", "Glutes")).toBe("Glute kickback");
    expect(pattern("Dumbbell Seated Overhead Press", "Overhead Press")).toBe("Overhead press");
    expect(pattern("Incline Dumbbell Press", "Push")).toBe("Chest press");
    expect(pattern("Close-Grip Lat Pulldown", "Pull")).toBe("Lat pulldown");
    expect(pattern("Close-Grip Bench Press", "Triceps")).toBe("Close-grip press");
    expect(pattern("Reverse Pec Deck", "Shoulders")).toBe("Rear shoulder fly");
    expect(pattern("Single-Leg Romanian Deadlift", "Posterior Chain")).toBe("Single-leg Romanian deadlift");
    expect(pattern("Rowing Machine Steady State", "Cardio")).toBe("Rowing and ski machine");
    expect(pattern("Seated Cable Row", "Pull")).toBe("Row");
  });
  it("gives the fight conditioning moves their own steps", () => {
    const steps = (name: string, category: string) => techniqueFor(name, category)?.steps[0] ?? "";
    expect(steps("Bird Dog", "Core")).toMatch(/all fours/);
    expect(steps("Dead Bug", "Core")).toMatch(/on your back/);
    expect(steps("Neck Curl", "Neck")).toMatch(/on your back/);
    expect(steps("Neck Extension", "Neck")).toMatch(/face down/);
    expect(pattern("Shadow Boxing", "Cardio")).toBe("Shadow boxing");
    expect(pattern("Battle Ropes", "Cardio")).toBe("Battle ropes");
    expect(pattern("Jump Rope", "Cardio")).toBe("Skipping");
  });

  it("falls back on the body part for a trainer's own exercise", () => {
    expect(pattern("Grizz special", "Biceps")).toBe("Biceps curl");
    expect(techniqueFor("Grizz special", null)).toBeNull();
  });

  it("keeps every guide short and complete", () => {
    for (const t of ALL_TECHNIQUES) {
      expect(t.steps.length).toBeGreaterThanOrEqual(3);
      expect(t.steps.length).toBeLessThanOrEqual(4);
      expect(t.tips.length).toBeGreaterThan(0);
      expect(t.adapt.length).toBeGreaterThan(0);
    }
  });

  it("never recommends oats or hack squats", () => {
    const text = JSON.stringify(ALL_TECHNIQUES).toLowerCase();
    expect(text).not.toContain("oat");
    expect(text).not.toContain("hack");
  });
});

describe("muscle not weight reminder", () => {
  it("uses GRIZZ's rule", async () => {
    const { MUSCLE_NOT_WEIGHT } = await import("./exerciseTechnique");
    expect(MUSCLE_NOT_WEIGHT).toContain("swing, jerk or bounce");
    expect(MUSCLE_NOT_WEIGHT).toContain("Focus on the muscle, not the weight.");
  });
});
