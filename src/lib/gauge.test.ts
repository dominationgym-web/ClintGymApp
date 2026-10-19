import { describe, expect, it } from "vitest";
import { estimatedMax, gaugeWeight, inIntro, introWeeks, needsGauge, needsSafeties } from "@/lib/gauge";

const bench = { name: "Barbell Bench Press", category: "Chest" };

describe("needsGauge", () => {
  it("is the first working set of an exercise never done before", () => {
    expect(needsGauge([], [], "8-10")).toBe(true);
    expect(needsGauge([], [{ weight_kg: 20, reps: 16, effort: "comfortable", warm_up: true }], "8-10")).toBe(true);
  });

  it("isn't needed once there's history, after the first set, or for timed work", () => {
    expect(needsGauge([{ weight_kg: 40, reps: 10, effort: "comfortable" }], [], "8-10")).toBe(false);
    expect(needsGauge([], [{ weight_kg: 40, reps: 12, effort: "failure" }], "8-10")).toBe(false);
    expect(needsGauge([], [], "30 sec")).toBe(false);
  });

  it("covers one-side reps, but not bodyweight moves", () => {
    expect(needsGauge([], [], "12-15 each side", "Dumbbell Bulgarian Split Squat")).toBe(true);
    expect(needsGauge([], [], "8 each side", "Bird Dog")).toBe(false);
    expect(needsGauge([], [], "8-10", "Push-Up")).toBe(false);
    expect(needsGauge([], [], "5", "Weighted Pull-Up")).toBe(true);
  });
});

describe("estimatedMax", () => {
  it("adds the reps left in the tank and caps the reps at 12", () => {
    expect(estimatedMax(60, 9, 1)).toBeCloseTo(80);
    expect(estimatedMax(50, 20)).toBeCloseTo(estimatedMax(50, 12));
  });
});

describe("gaugeWeight", () => {
  it("works out the weight for the top of the range with reps in reserve", () => {
    // 60kg × 9 with 1 left → 10 reps → 80kg max. Intro: 10 + 2 reps → 80 / 1.4 ≈ 57.1 → 55kg.
    expect(gaugeWeight({ weight: 60, reps: 9 }, "8-10", bench, true)?.weight).toBe(55);
    // After the intro, 1 rep in reserve: 80 / (1 + 11/30) ≈ 58.5 → 57.5kg.
    expect(gaugeWeight({ weight: 60, reps: 9 }, "8-10", bench, false)?.weight).toBe(57.5);
  });

  it("brings the weight down when the gauge weight was too heavy", () => {
    // 60 × 5 (+1) → 72kg max; 10-12 + 2 → 72 / 1.467 ≈ 49.1 → 47.5kg.
    expect(gaugeWeight({ weight: 60, reps: 5 }, "10-12", bench, true)?.weight).toBe(47.5);
  });

  it("treats very high-rep gauge sets as a rough guess", () => {
    const r = gaugeWeight({ weight: 50, reps: 15 }, "8-10", bench, true);
    // Capped at 12 reps: 50 × 1.4 = 70kg max → 70 / 1.4 = 50kg.
    expect(r?.weight).toBe(50);
    expect(r?.advice).toContain("rough guess");
    expect(gaugeWeight({ weight: 60, reps: 9 }, "8-10", bench, true)?.advice).not.toContain("rough guess");
  });

  it("rounds to weights the gym has", () => {
    expect(gaugeWeight({ weight: 8, reps: 11 }, "12-15", { name: "Dumbbell Curl", category: "Biceps" }, true)?.weight).toBe(6);
    expect(gaugeWeight({ weight: 100, reps: 11 }, "8-10", { name: "Barbell Back Squat", category: "Legs" }, true)?.weight).toBe(100);
    expect(gaugeWeight({ weight: 24, reps: 11 }, "8-10", { name: "Kettlebell Romanian Deadlift", category: "Hamstrings" }, true)?.weight).toBe(24);
  });

  it("says how hard to push, and never says failure", () => {
    const r = gaugeWeight({ weight: 60, reps: 9 }, "8-10", bench, true);
    expect(r?.advice).toContain("2 more good reps");
    expect(r?.advice).not.toMatch(/failure/);
    expect(gaugeWeight({ weight: 60, reps: 9 }, "8-10", bench, false)?.advice).toContain("1 more good rep");
    expect(gaugeWeight({ weight: 60, reps: 9 }, "30 sec", bench, true)).toBeNull();
  });
});

describe("needsSafeties", () => {
  it("is for free-weight barbell squats and bench presses", () => {
    expect(needsSafeties("Barbell Back Squat")).toBe(true);
    expect(needsSafeties("Barbell Bench Press")).toBe(true);
    expect(needsSafeties("Smith Machine Squat")).toBe(false);
    expect(needsSafeties("Dumbbell Bench Press")).toBe(false);
    expect(needsSafeties("Leg Press")).toBe(false);
  });
});

describe("inIntro", () => {
  it("covers the first 6 weeks and Foundation programs", () => {
    expect(inIntro("Strength 12-week program", "2026-10-01", "2026-10-17")).toBe(true);
    expect(inIntro("Strength 12-week program", "2026-08-01", "2026-10-17")).toBe(false);
    expect(inIntro("Beginner Foundation - Strength", "2026-08-01", "2026-10-17")).toBe(true);
  });

  it("is 2 weeks for advanced clients, and none without a plan start", () => {
    expect(inIntro("Strength 12-week program", "2026-10-01", "2026-10-17", "advanced")).toBe(false);
    expect(inIntro("Strength 12-week program", "2026-10-10", "2026-10-17", "advanced")).toBe(true);
    expect(inIntro("Strength 12-week program", null, "2026-10-17", "advanced")).toBe(false);
    expect(inIntro("Strength 12-week program", null, "2026-10-17", "beginner")).toBe(true);
    expect(inIntro("Strength 12-week program", "2026-10-01", "2026-10-17", "intermediate")).toBe(true);
    expect(introWeeks("advanced")).toBe(2);
    expect(introWeeks("never")).toBe(6);
  });
});
