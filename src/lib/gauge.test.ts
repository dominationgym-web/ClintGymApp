import { describe, expect, it } from "vitest";
import { estimatedMax, gaugeWeight, inIntro, needsGauge } from "@/lib/gauge";

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
});

describe("gaugeWeight", () => {
  it("works out the weight for the top of the range with reps in reserve", () => {
    // 50kg × 15 to failure → about 75kg max. Intro: 10 + 2 reps → 75 / 1.4 ≈ 53.6 → 52.5kg.
    expect(estimatedMax(50, 15)).toBeCloseTo(75);
    expect(gaugeWeight({ weight: 50, reps: 15 }, "8-10", bench, true)?.weight).toBe(52.5);
    // After the intro, 1 rep in reserve: 75 / (1 + 11/30) ≈ 54.9 → 52.5kg.
    expect(gaugeWeight({ weight: 50, reps: 15 }, "8-10", bench, false)?.weight).toBe(52.5);
  });

  it("brings the weight down when the gauge weight was too heavy", () => {
    expect(gaugeWeight({ weight: 60, reps: 5 }, "10-12", bench, true)?.weight).toBe(47.5);
  });

  it("rounds light weights to whole kilos and big lower-body lifts to 5kg", () => {
    expect(gaugeWeight({ weight: 8, reps: 20 }, "12-15", { name: "Dumbbell Curl", category: "Biceps" }, true)?.weight).toBe(8);
    expect(gaugeWeight({ weight: 100, reps: 12 }, "8-10", { name: "Barbell Back Squat", category: "Legs" }, true)?.weight).toBe(100);
  });

  it("says how hard to push", () => {
    expect(gaugeWeight({ weight: 50, reps: 15 }, "8-10", bench, true)?.advice).toContain("2 more good reps");
    expect(gaugeWeight({ weight: 50, reps: 15 }, "8-10", bench, false)?.advice).toContain("1 more good rep");
    expect(gaugeWeight({ weight: 50, reps: 15 }, "30 sec", bench, true)).toBeNull();
  });
});

describe("inIntro", () => {
  it("covers the first 6 weeks and Foundation programs", () => {
    expect(inIntro("Strength 12-week program", "2026-10-01", "2026-10-17")).toBe(true);
    expect(inIntro("Strength 12-week program", "2026-08-01", "2026-10-17")).toBe(false);
    expect(inIntro("Beginner Foundation - Strength", "2026-08-01", "2026-10-17")).toBe(true);
  });
});
