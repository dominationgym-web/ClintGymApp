import { describe, expect, it } from "vitest";
import { lastPainFor, likelyPainArea, painSuggestions, shortDate, type ExercisePain } from "@/lib/painSwap";

const lib = [
  ["Barbell Overhead Press", "Overhead Press"],
  ["Dumbbell Seated Overhead Press", "Overhead Press"],
  ["Landmine Press", "Shoulders"],
  ["Incline Dumbbell Press", "Push"],
  ["Incline Barbell Press", "Push"],
  ["Flat Dumbbell Press", "Push"],
  ["Neutral-Grip Dumbbell Bench Press", "Push"],
  ["Machine Chest Press", "Push"],
  ["Floor Press", "Push"],
  ["Bench Press", "Push"],
  ["Decline Machine Chest Press", "Push"],
  ["Wide-Grip Lat Pulldown", "Pull"],
  ["Neutral-Grip Lat Pulldown", "Pull"],
  ["Chest-Supported Row", "Pull"],
  ["Pull-Up", "Pull"],
  ["Dumbbell Lateral Raise", "Shoulders"],
  ["Cable Low Single-Arm Lateral Raise", "Shoulders"],
  ["Cable Bar Face Pull", "Shoulders"],
  ["Leg Press", "Legs"],
  ["Barbell Back Squat", "Legs"],
].map(([name, category], i) => ({ id: `e${i}`, name, category }));
const ex = (name: string) => lib.find((e) => e.name === name)!;
const names = (name: string, hurt: string[] = []) =>
  painSuggestions(ex(name), "shoulder", lib, hurt.map((n) => ex(n).id)).suggestions.map((s) => s.exercise.name);

describe("This hurts: shoulder", () => {
  it("offers a flat press when an incline press hurts", () => {
    expect(names("Incline Dumbbell Press")[0]).toBe("Flat Dumbbell Press");
    expect(names("Incline Dumbbell Press")).not.toContain("Incline Barbell Press");
  });

  it("steps down from overhead pressing, never to another overhead press", () => {
    const got = names("Barbell Overhead Press");
    expect(got[0]).toBe("Landmine Press");
    expect(got).toContain("Incline Dumbbell Press");
    expect(got).not.toContain("Dumbbell Seated Overhead Press");
  });

  it("moves on to the next step when the one they tried hurts too", () => {
    expect(names("Flat Dumbbell Press", ["Incline Dumbbell Press"])).toEqual(["Neutral-Grip Dumbbell Bench Press", "Floor Press", "Decline Machine Chest Press"]);
    expect(names("Barbell Overhead Press", ["Landmine Press"])[0]).toBe("Incline Dumbbell Press");
  });

  it("swaps a wide grip pulldown for a neutral grip, and raises for lower ones", () => {
    expect(names("Wide-Grip Lat Pulldown")[0]).toBe("Neutral-Grip Lat Pulldown");
    expect(names("Dumbbell Lateral Raise").slice(0, 2)).toEqual(["Cable Low Single-Arm Lateral Raise", "Cable Bar Face Pull"]);
  });

  it("gives a tip for doing the new one comfortably", () => {
    expect(painSuggestions(ex("Incline Dumbbell Press"), "shoulder", lib).tip).toMatch(/45°/);
  });
});

describe("This hurts: other areas", () => {
  it("falls back to the same body part with nothing flagged for that area", () => {
    const got = painSuggestions(ex("Barbell Back Squat"), "knee", lib).suggestions.map((s) => s.exercise.name);
    expect(got).toEqual([]);
    expect(painSuggestions(ex("Barbell Back Squat"), "core", lib).suggestions.map((s) => s.exercise.name)).toEqual(["Leg Press"]);
  });

  it("guesses where it hurts from the exercise", () => {
    expect(likelyPainArea("Incline Dumbbell Press", "Push")).toBe("shoulder");
    expect(likelyPainArea("Leg Press", "Legs")).toBe("knee");
    expect(likelyPainArea("Plank", "Core")).toBeNull();
  });
});

describe("past reports", () => {
  const report = (exercise_id: string | null, exercise_name: string, created_at: string): ExercisePain => ({
    id: created_at,
    client_id: "c",
    exercise_id,
    exercise_name,
    area: "shoulder",
    tried_exercise_id: null,
    tried_name: null,
    created_at,
  });

  it("finds the latest report for an exercise", () => {
    const rows = [report("e3", "Incline Dumbbell Press", "2026-10-13T08:00:00Z"), report("e3", "Incline Dumbbell Press", "2026-10-20T08:00:00Z"), report("e5", "Flat Dumbbell Press", "2026-10-21T08:00:00Z")];
    expect(lastPainFor(rows, { exercise_id: "e3", exercise_name: "Incline Dumbbell Press" })?.created_at).toBe("2026-10-20T08:00:00Z");
    expect(lastPainFor(rows, { exercise_id: "e9", exercise_name: "Leg Press" })).toBeNull();
    expect(shortDate("2026-10-20T08:00:00Z")).toMatch(/^20 Oct$/);
  });
});
