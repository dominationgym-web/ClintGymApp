import { describe, expect, it } from "vitest";
import { cardioFor, extrasAllowed, withClientCardio } from "@/lib/clientExtras";
import { absBetweenSets } from "@/lib/absBetweenSets";
import type { ProgramExercise } from "@/types/database";

const prog = (name: string, abs = false) => ({ name, trainer_id: null, abs_between_sets: abs });
const extras = [
  { after: 2, name: "Assault bike", reps: "30 sec" },
  { after: null, name: "Treadmill", reps: "10 min" },
];

describe("extras for a client (0136)", () => {
  it("leaves Longevity, mobility and flexibility alone", () => {
    for (const name of ["Older Adult 2 - Strength & Stability", "Mobility 1 – Hips & Ankles", "Flexibility 4 – Lower Back Release"]) {
      expect(extrasAllowed(prog(name))).toEqual({ abs: false, cardioBetween: false, cardioEnd: false });
      expect(cardioFor(prog(name), extras)).toEqual([]);
      expect(absBetweenSets(prog(name, true), { abs_all: true })).toBe(false);
    }
  });

  it("gives bodybuilding abs and cardio at the end only", () => {
    expect(cardioFor(prog("Bodybuilding 12-week program"), extras)).toEqual([extras[1]]);
    expect(absBetweenSets(prog("Bodybuilding 12-week program"), { abs_all: true })).toBe(true);
  });

  it("gives every other workout both, and abs only when built in or switched on for all", () => {
    expect(cardioFor(prog("Strength 12-week program"), extras)).toEqual(extras);
    expect(absBetweenSets(prog("Strength 12-week program"), {})).toBe(false);
    expect(absBetweenSets(prog("Strength 12-week program"), { abs_all: true })).toBe(true);
    expect(absBetweenSets(prog("Upper Body 1", true), {})).toBe(true);
    expect(absBetweenSets(prog("Upper Body 1", true), { abs_between_sets: false, abs_all: true })).toBe(false);
  });

  it("slots the cardio into the workout", () => {
    const row = (i: number): ProgramExercise =>
      ({ id: `r${i}`, program_id: "p", day_number: 1, week_number: 1, sort_order: i, exercise_id: `e${i}`, exercise_name: `Ex ${i}`, sets: 3, reps: "10", rest_seconds: 60, kind: "exercise" }) as ProgramExercise;
    const out = withClientCardio(prog("Strength 12-week program"), [row(1), row(2), row(3)], extras);
    expect(out.map((r) => r.exercise_name)).toEqual(["Ex 1", "Ex 2", "Assault bike", "Ex 3", "Treadmill"]);
  });
});
