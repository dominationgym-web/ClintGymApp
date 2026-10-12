import { describe, expect, it } from "vitest";
import { abExerciseFor, absBetweenSets, AB_EXERCISES } from "./absBetweenSets";

describe("absBetweenSets", () => {
  it("is on only when the workout has it and the trainer hasn't switched it off", () => {
    expect(absBetweenSets({ abs_between_sets: true }, { abs_between_sets: true })).toBe(true);
    expect(absBetweenSets({ abs_between_sets: true }, {})).toBe(true);
    expect(absBetweenSets({ abs_between_sets: true }, { abs_between_sets: false })).toBe(false);
    expect(absBetweenSets({ abs_between_sets: false }, { abs_between_sets: true })).toBe(false);
    expect(absBetweenSets(null, { abs_between_sets: true })).toBe(false);
  });

  it("rotates through the ab exercises", () => {
    expect(abExerciseFor(0)).toBe(AB_EXERCISES[0]);
    expect(abExerciseFor(1)).toBe(AB_EXERCISES[1]);
    expect(abExerciseFor(AB_EXERCISES.length)).toBe(AB_EXERCISES[0]);
  });

  it("uses the trainer's chosen ab exercise every set", () => {
    expect(abExerciseFor(0, "Plank taps")).toBe("Plank taps");
    expect(abExerciseFor(3, "Plank taps")).toBe("Plank taps");
    expect(abExerciseFor(3, "  ")).toBe(AB_EXERCISES[3]);
  });
});
