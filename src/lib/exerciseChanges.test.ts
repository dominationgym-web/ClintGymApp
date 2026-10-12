import { describe, expect, it } from "vitest";
import { applyExerciseChanges, planChangeWrites } from "@/lib/exerciseChanges";
import type { ProgramExercise } from "@/types/database";

const row = (id: string, exercise_id: string, exercise_name: string, extra: Partial<ProgramExercise> = {}) =>
  ({ id, exercise_id, exercise_name, sets: 3, reps: "8-10", rest_seconds: 60, kind: "exercise", ...extra }) as ProgramExercise;

const change = (fields: Record<string, unknown>) => ({
  id: "c" + Math.random(),
  program_exercise_id: null,
  original_exercise_id: null,
  exercise_id: null,
  exercise_name: null,
  sets: null,
  reps: null,
  ...fields,
});

describe("applyExerciseChanges", () => {
  const rows = [row("r1", "squat", "Barbell Back Squat"), row("r2", "curl", "Leg Curl"), row("r3", "squat", "Barbell Back Squat")];

  it("swaps an exercise out of every workout", () => {
    const out = applyExerciseChanges(rows, [change({ original_exercise_id: "squat", exercise_id: "press", exercise_name: "Leg Press" })]);
    expect(out.map((r) => r.exercise_name)).toEqual(["Leg Press", "Leg Curl", "Leg Press"]);
    expect(out[0].changed_from?.exercise_name).toBe("Barbell Back Squat");
    expect(out[1].changed_from).toBeUndefined();
  });

  it("lets a one-workout change win, field by field", () => {
    const out = applyExerciseChanges(rows, [
      change({ original_exercise_id: "squat", exercise_id: "press", exercise_name: "Leg Press" }),
      change({ program_exercise_id: "r3", sets: 2, reps: "12-15" }),
      change({ program_exercise_id: "r2", exercise_id: "nordic", exercise_name: "Nordic Hamstring Curl" }),
    ]);
    expect(out[2]).toMatchObject({ exercise_name: "Leg Press", sets: 2, reps: "12-15" });
    expect(out[1]).toMatchObject({ exercise_name: "Nordic Hamstring Curl", sets: 3 });
  });

  it("leaves cardio alone", () => {
    const cardio = { ...row("c1", "", "Treadmill"), exercise_id: null, kind: "cardio" } as ProgramExercise;
    expect(applyExerciseChanges([cardio], [change({ program_exercise_id: "c1", sets: 9 })])[0]).toBe(cardio);
  });
});

describe("planChangeWrites", () => {
  const r = row("r1", "squat", "Barbell Back Squat");

  it("swaps everywhere and keeps sets and reps changes to this workout", () => {
    const { upserts, removes } = planChangeWrites("client", r, [], {
      exercise: { id: "press", name: "Leg Press" },
      sets: 4,
      reps: "8-10",
      everywhere: true,
    });
    expect(removes).toEqual([]);
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toMatchObject({ original_exercise_id: "squat", exercise_id: "press" });
    expect(upserts[1]).toMatchObject({ program_exercise_id: "r1", exercise_id: null, sets: 4, reps: null });
  });

  it("removes changes that are no longer needed", () => {
    const everywhere = change({ original_exercise_id: "squat", exercise_id: "press", exercise_name: "Leg Press" });
    const own = change({ program_exercise_id: "r1", sets: 4 });
    const { upserts, removes } = planChangeWrites("client", r, [everywhere, own], {
      exercise: { id: "squat", name: "Barbell Back Squat" },
      sets: 3,
      reps: "8-10",
      everywhere: true,
    });
    expect(upserts).toEqual([]);
    expect(removes.sort()).toEqual([everywhere.id, own.id].sort());
  });

  it("keeps the original in just this workout when it is swapped everywhere", () => {
    const everywhere = change({ original_exercise_id: "squat", exercise_id: "press", exercise_name: "Leg Press" });
    const { upserts } = planChangeWrites("client", r, [everywhere], {
      exercise: { id: "squat", name: "Barbell Back Squat" },
      sets: 3,
      reps: "8-10",
      everywhere: false,
    });
    expect(upserts).toEqual([expect.objectContaining({ program_exercise_id: "r1", exercise_id: "squat" })]);
  });
});
