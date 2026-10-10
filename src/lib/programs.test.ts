import { describe, expect, it } from "vitest";
import {
  dayTitle,
  defaultSessionTitle,
  displayProgramName,
  supersetNext,
  nextUnfinished,
  resizeExercises,
  blankCardio,
  cardioLabel,
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
  kind: "exercise",
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
    const week = { kind: "weekly" as const, name: "Full body week", trainer_id: null, day_titles: ["A", "B", "C", "A", "B", "C", "Rest day"] };
    expect(dayTitle(week, monday)).toBe("A");
    expect(dayTitle(week, sunday)).toBe("Rest day");
    expect(dayTitle({ kind: "quick", name: "Quick", trainer_id: null, day_titles: [] }, sunday)).toBe("Quick");
    expect(dayTitle({ kind: "quick", name: "Chest & Bi 2", trainer_id: null, day_titles: [] }, sunday)).toBe("Chest & Bi");
  });
});

describe("displayProgramName", () => {
  it("drops the set number from built-in programs only", () => {
    expect(displayProgramName({ name: "Chest & Bi 1", trainer_id: null })).toBe("Chest & Bi");
    expect(displayProgramName({ name: "Legs 4", trainer_id: null })).toBe("Legs");
    expect(displayProgramName({ name: "Quick full body (35 min)", trainer_id: null })).toBe("Quick full body (35 min)");
    expect(displayProgramName({ name: "Phase 2", trainer_id: "t1" })).toBe("Phase 2");
  });
});

describe("supersetNext", () => {
  it("points a no-rest exercise at the one after it", () => {
    const a1 = { ...row(1, 1, "Bench"), rest_seconds: 0 };
    const a2 = { ...row(1, 2, "Curl"), rest_seconds: 120 };
    const session = [a1, a2];
    expect(supersetNext(a1, session)?.exercise_name).toBe("Curl");
    expect(supersetNext(a2, session)).toBeNull();
    expect(supersetNext({ ...a2, rest_seconds: 0 }, session)).toBeNull();
  });
});

describe("nextUnfinished", () => {
  const a = { ...row(1, 1, "Bench"), sets: 3 };
  const b = { ...row(1, 2, "Row"), id: "b", sets: 3 };
  const c = { ...row(1, 3, "Squat"), id: "c", sets: 3 };
  const session = [a, b, c];
  it("goes to the next exercise with sets left", () => {
    const done: Record<string, number> = { [a.id]: 3, b: 0, c: 0 };
    expect(nextUnfinished(a, session, (e) => done[e.id])?.exercise_name).toBe("Row");
  });
  it("skips finished ones and wraps back to one that was skipped", () => {
    const done: Record<string, number> = { [a.id]: 1, b: 3, c: 3 };
    expect(nextUnfinished(c, session, (e) => done[e.id])?.exercise_name).toBe("Bench");
  });
  it("is null when the whole workout is done", () => {
    expect(nextUnfinished(c, session, (e) => e.sets)).toBeNull();
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

describe("cardio blocks", () => {
  const ex = { exerciseId: "e", exerciseName: "Squat", sets: 3, reps: "10", restSeconds: 90 };
  const blank = () => ({ ...ex, exerciseName: "" });
  it("keeps cardio in place when changing the number of exercises", () => {
    const slots = [ex, blankCardio(), ex, ex, blankCardio()];
    const fewer = resizeExercises(slots, 2, blank);
    expect(fewer.map((s) => s.kind ?? "exercise")).toEqual(["exercise", "cardio", "exercise", "cardio"]);
    const more = resizeExercises(slots, 4, blank);
    expect(more.map((s) => s.exerciseName)).toEqual(["Squat", "Assault bike", "Squat", "Squat", "", "Assault bike"]);
  });
  it("reads naturally", () => {
    expect(cardioLabel({ exercise_name: "Ski Erg", reps: "20 sec" })).toBe("Ski Erg · 20 sec");
    expect(cardioLabel({ exercise_name: "All of the above", reps: "30 sec" })).toBe("All of the above · 30 sec each");
    expect(cardioLabel({ exercise_name: "Cardio", reps: "Run 5km at speed 8, incline 6" })).toBe("Run 5km at speed 8, incline 6");
  });
  it("won't save a cardio block with nothing chosen", () => {
    expect(draftProblem("Legs", [ex, { ...blankCardio(), reps: " " }])).toBe("Choose the cardio and how long for slot 2.");
  });
});
