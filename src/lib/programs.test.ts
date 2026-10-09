import { describe, expect, it } from "vitest";
import {
  dayTitle,
  defaultSessionTitle,
  draftProblem,
  weeklyDraftProblem,
  exercisesForDate,
  formatClock,
  formatRest,
  needsWarmUp,
  programDayNumber,
  warmUpReps,
} from "@/lib/programs";
import type { ProgramExercise } from "@/types/database";

const row = (day_number: number, sort_order: number, exercise_name: string): ProgramExercise => ({
  id: `${day_number}-${sort_order}`,
  program_id: "p",
  day_number,
  sort_order,
  exercise_id: null,
  exercise_name,
  sets: 3,
  reps: "10",
  rest_seconds: 90,
});

// 2026-10-05 is a Monday.
const monday = new Date(2026, 9, 5, 7);
const sunday = new Date(2026, 9, 11, 22);

describe("programDayNumber", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(programDayNumber(monday)).toBe(1);
    expect(programDayNumber(new Date(2026, 9, 8))).toBe(4);
    expect(programDayNumber(sunday)).toBe(7);
  });
});

describe("exercisesForDate", () => {
  const rows = [row(1, 2, "Bench"), row(1, 1, "Squat"), row(2, 1, "Deadlift")];

  it("gives a weekly program the exercises for that weekday, in order", () => {
    expect(exercisesForDate({ kind: "weekly" }, rows, monday).map((e) => e.exercise_name)).toEqual(["Squat", "Bench"]);
    expect(exercisesForDate({ kind: "weekly" }, rows, new Date(2026, 9, 6)).map((e) => e.exercise_name)).toEqual([
      "Deadlift",
    ]);
    expect(exercisesForDate({ kind: "weekly" }, rows, sunday)).toEqual([]);
  });

  it("gives quick and custom programs the same session every day", () => {
    expect(exercisesForDate({ kind: "quick" }, rows, sunday).map((e) => e.exercise_name)).toEqual(["Squat", "Bench"]);
    expect(exercisesForDate({ kind: "custom" }, rows, monday)).toHaveLength(2);
  });
});

describe("dayTitle", () => {
  it("uses the weekday's title for weekly programs and the name otherwise", () => {
    const week = { kind: "weekly" as const, name: "Full body week", day_titles: ["A", "B", "C", "A", "B", "C", "Rest day"] };
    expect(dayTitle(week, monday)).toBe("A");
    expect(dayTitle(week, sunday)).toBe("Rest day");
    expect(dayTitle({ kind: "quick", name: "Quick", day_titles: [] }, sunday)).toBe("Quick");
  });
});

describe("formatRest and formatClock", () => {
  it("reads naturally", () => {
    expect(formatRest(45)).toBe("45 sec");
    expect(formatRest(120)).toBe("2 min");
    expect(formatRest(150)).toBe("2 min 30 sec");
    expect(formatClock(180)).toBe("3:00");
    expect(formatClock(64.2)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("warmUpReps", () => {
  it("doubles the working reps", () => {
    expect(warmUpReps("8-10")).toBe("16-20");
    expect(warmUpReps("5")).toBe("10");
    expect(warmUpReps("10 each leg")).toBe("20 each leg");
  });

  it("skips timed holds", () => {
    expect(warmUpReps("45 sec")).toBeNull();
    expect(warmUpReps("max")).toBeNull();
  });
});

describe("needsWarmUp", () => {
  it("is due for the first exercise of each body part only", () => {
    expect(needsWarmUp("Legs", [])).toBe(true);
    expect(needsWarmUp("Legs", ["Push", "Legs"])).toBe(false);
    expect(needsWarmUp("Pull", ["Push", "Legs"])).toBe(true);
  });

  it("skips core work and unknown body parts", () => {
    expect(needsWarmUp("Core", [])).toBe(false);
    expect(needsWarmUp(null, [])).toBe(false);
  });
});

describe("draftProblem", () => {
  const ex = { exerciseId: "x", exerciseName: "Squat", sets: 3, reps: "8-10", restSeconds: 120 };

  it("accepts a complete program", () => {
    expect(draftProblem("Leg day", [ex, ex, ex, ex])).toBeNull();
  });

  it("names what's missing", () => {
    expect(draftProblem(" ", [ex])).toBe("Give the program a name.");
    expect(draftProblem("Leg day", [ex, { ...ex, exerciseName: "" }])).toBe("Pick an exercise for slot 2.");
    expect(draftProblem("Leg day", [{ ...ex, reps: " " }])).toBe("Add the reps for Squat.");
  });
});

describe("weeklyDraftProblem", () => {
  const ex = { exerciseId: "1", exerciseName: "Squat", sets: 3, reps: "8-12", restSeconds: 120 };

  it("accepts a week with every slot filled", () => {
    expect(weeklyDraftProblem("My week", [{ day: 1, title: "A", exercises: [ex] }, { day: 3, title: "B", exercises: [ex] }])).toBeNull();
  });

  it("names the day that's not ready", () => {
    expect(weeklyDraftProblem("My week", [])).toBe("Pick at least one training day.");
    expect(weeklyDraftProblem("My week", [{ day: 3, title: "B", exercises: [{ ...ex, exerciseName: "" }] }])).toBe(
      "Wednesday: pick an exercise for slot 1."
    );
    expect(weeklyDraftProblem("My week", [{ day: 5, title: "C", exercises: [{ ...ex, reps: "" }] }])).toBe(
      "Friday: add the reps for Squat."
    );
  });

  it("titles sessions A, B, C", () => {
    expect([0, 1, 2].map(defaultSessionTitle)).toEqual(["Workout A", "Workout B", "Workout C"]);
  });
});
