import { describe, expect, it } from "vitest";
import { RESET_GUIDES } from "@/lib/resetGuides";

describe("RESET_GUIDES", () => {
  it("has guidance for all eight Daily 6 habits", () => {
    expect(Object.keys(RESET_GUIDES).sort()).toEqual(
      [
        "aerobic_exercise",
        "breathing",
        "consistent_sleep",
        "daily_movement",
        "evening_winddown",
        "morning_daylight",
        "protein_meals",
        "strength_training",
      ].sort(),
    );
  });

  it.each(Object.entries(RESET_GUIDES))("%s has a why, steps, tips and an easier option", (_key, guide) => {
    expect(guide.title.trim()).not.toBe("");
    expect(guide.why.trim()).not.toBe("");
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.tips.length).toBeGreaterThan(0);
    expect(guide.easier.trim()).not.toBe("");
    // Steps and tips are used as React keys, so they must be unique.
    expect(new Set(guide.steps).size).toBe(guide.steps.length);
    expect(new Set(guide.tips).size).toBe(guide.tips.length);
  });
});
