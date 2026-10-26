import { describe, expect, it } from "vitest";
import { formatSteps, isStepEvening, mergeWatchSteps, parseSteps, stepProgress, stepStatus, stepStreak, validGoal, walkMinutes } from "@/lib/steps";

describe("steps", () => {
  it("writes steps with spaces", () => {
    expect(formatSteps(10000)).toBe("10 000");
    expect(formatSteps(950)).toBe("950");
    expect(formatSteps(123456)).toBe("123 456");
  });

  it("reads what the client typed", () => {
    expect(parseSteps("8 500")).toBe(8500);
    expect(parseSteps("8,500")).toBe(8500);
    expect(parseSteps("abc")).toBeNull();
    expect(parseSteps("")).toBeNull();
    expect(parseSteps("999999")).toBeNull();
  });

  it("keeps goals between 1 000 and 50 000", () => {
    expect(validGoal(10000)).toBe(10000);
    expect(validGoal(500)).toBeNull();
    expect(validGoal(60000)).toBeNull();
    expect(validGoal(null)).toBeNull();
  });

  it("works out the walk left", () => {
    expect(walkMinutes(0)).toBe(0);
    expect(walkMinutes(100)).toBe(5);
    expect(walkMinutes(3760)).toBe(40);
    expect(stepStatus(6240, 10000)).toBe("3 760 to go: about 40 minutes of walking.");
    expect(stepStatus(11000, 10000)).toMatch(/^Goal hit!/);
  });

  it("caps the bar", () => {
    expect(stepProgress(5000, 10000)).toBe(0.5);
    expect(stepProgress(15000, 10000)).toBe(1);
    expect(stepProgress(5000, 0)).toBe(0);
  });

  it("turns into the evening banner from 7pm", () => {
    expect(isStepEvening(new Date(2026, 9, 26, 18, 59))).toBe(false);
    expect(isStepEvening(new Date(2026, 9, 26, 19, 0))).toBe(true);
  });

  it("counts days in a row", () => {
    const days = [
      { step_date: "2026-10-23", steps: 10500, goal: 10000 },
      { step_date: "2026-10-24", steps: 12000, goal: 10000 },
      { step_date: "2026-10-25", steps: 9000, goal: 8000 },
      { step_date: "2026-10-26", steps: 3000, goal: 10000 },
    ];
    // Today isn't hit yet: the run up to yesterday stands.
    expect(stepStreak(days, "2026-10-26", 10000)).toBe(3);
    expect(stepStreak([...days.slice(0, 3), { step_date: "2026-10-26", steps: 10000, goal: 10000 }], "2026-10-26", 10000)).toBe(4);
    expect(stepStreak([{ step_date: "2026-10-24", steps: 12000, goal: null }], "2026-10-26", 10000)).toBe(0);
  });

  it("keeps typed-in steps when they're higher than the watch", () => {
    expect(mergeWatchSteps({ steps: 9000, source: "manual" }, 4000, "apple_health")).toEqual({ steps: 9000, source: "manual" });
    expect(mergeWatchSteps({ steps: 3000, source: "manual" }, 4000, "apple_health")).toEqual({ steps: 4000, source: "apple_health" });
    expect(mergeWatchSteps({ steps: 9000, source: "health_connect" }, 4000, "health_connect")).toEqual({ steps: 4000, source: "health_connect" });
    expect(mergeWatchSteps(null, 4000.4, "health_connect")).toEqual({ steps: 4000, source: "health_connect" });
  });
});
