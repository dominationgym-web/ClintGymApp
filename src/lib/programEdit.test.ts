import { describe, expect, it } from "vitest";
import { programRowWrites, sessionsFromProgram } from "@/lib/programs";
import type { ProgramExercise } from "@/types/database";

const row = (id: string, day: number, sort: number, name: string): ProgramExercise => ({
  id,
  program_id: "p",
  day_number: day,
  week_number: 1,
  sort_order: sort,
  exercise_id: `e-${name}`,
  exercise_name: name,
  sets: 3,
  reps: "8-12",
  rest_seconds: 120,
  kind: "exercise",
});

describe("changing a saved program in the builder", () => {
  const rows = [row("r2", 1, 2, "Row"), row("r1", 1, 1, "Squat"), row("r3", 3, 1, "Bench")];
  const days = sessionsFromProgram(rows, ["Workout A", "", "Upper", "", "", "", ""]);

  it("loads each day in order with its saved rows", () => {
    expect(days.map((d) => d.day)).toEqual([1, 3]);
    expect(days[0].exercises.map((e) => e.exerciseName)).toEqual(["Squat", "Row"]);
    expect(days[0].exercises[0].rowId).toBe("r1");
    // A made-up title stays blank; the trainer's own one is kept.
    expect(days[0].title).toBe("");
    expect(days[1].title).toBe("Upper");
  });

  it("updates kept rows in place, adds new ones and removes the rest", () => {
    const changed = [
      { ...days[0], exercises: [{ ...days[0].exercises[1] }, { ...days[0].exercises[0], sets: 4 }, { exerciseId: "x", exerciseName: "Curl", sets: 3, reps: "10", restSeconds: 60 }] },
    ];
    const { updates, inserts, deletes } = programRowWrites("p", changed, ["r1", "r2", "r3"]);
    expect(updates.map((u) => [u.id, u.row.sort_order, u.row.sets])).toEqual([
      ["r2", 1, 3],
      ["r1", 2, 4],
    ]);
    expect(inserts.map((r) => r.exercise_name)).toEqual(["Curl"]);
    expect(deletes).toEqual(["r3"]);
  });

  it("never updates one row twice, or a row that's gone", () => {
    const twice = [{ ...days[0], exercises: [days[0].exercises[0], { ...days[0].exercises[0] }] }];
    const { updates, inserts } = programRowWrites("p", twice, ["r2"]);
    expect(updates).toEqual([]);
    expect(inserts).toHaveLength(2);
  });
});
