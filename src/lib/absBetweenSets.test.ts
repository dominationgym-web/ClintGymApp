import { describe, expect, it } from "vitest";
import { abExerciseFor, absAfterExercise, absBetweenSets, abRoundsDone, AB_EXERCISES } from "./absBetweenSets";

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

  it("skips abs after heavy lower-body and spine-loading lifts", () => {
    expect(absAfterExercise("Barbell Back Squat")).toBe(false);
    expect(absAfterExercise("Conventional Deadlift")).toBe(false);
    expect(absAfterExercise("Hip Thrust")).toBe(false);
    expect(absAfterExercise("Lat Pulldown")).toBe(true);
    expect(absAfterExercise("Leg Extension")).toBe(true);
    expect(AB_EXERCISES).not.toContain("Mountain climbers");
  });

  it("counts the ab rounds done today", () => {
    expect(
      abRoundsDone([
        { exercise_name: "Barbell Back Squat" },
        { exercise_name: "Leg Curl" },
        { exercise_name: "Leg Curl", warm_up: true },
        { exercise_name: "Leg Curl" },
      ]),
    ).toBe(2);
  });
});
