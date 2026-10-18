import { describe, expect, it } from "vitest";
import {
  applyMoves,
  monthLabel,
  monthOf,
  monthRange,
  monthWeeks,
  paceRest,
  shiftMonth,
  shortWorkoutName,
  usedInBatch,
  usedWorkoutIds,
  withPace,
  exercisesForSlot,
  programSlots,
  slotLabel,
 calendarDayLabels, functionalShortName, mondayOf, weekDates, weekLabel, bodyPartsLabel } from "@/lib/trainingCalendar";
import type { ProgramExercise } from "@/types/database";

describe("months", () => {
  it("lays October 2026 out Monday first", () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthWeeks({ year: 2026, month: 9 });
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks[weeks.length - 1]).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("moves between months across the year end", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(monthLabel(monthOf("2026-10-12"))).toBe("October 2026");
    expect(monthRange({ year: 2026, month: 1 })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("shortWorkoutName", () => {
  it("fits the calendar workouts in a cell", () => {
    expect(shortWorkoutName("Upper Body 3")).toBe("Upper 3");
    expect(shortWorkoutName("Lower Body Superset 12")).toBe("Lower SS 12");
    expect(shortWorkoutName("HIIT 4")).toBe("HIIT 4");
    expect(shortWorkoutName("Upper Body Superset 3", false)).toBe("Upper SS");
    expect(shortWorkoutName("Bodybuilding 3-week block")).toBe("Bodybuildin…");
  });
});

describe("usedWorkoutIds", () => {
  const programs = [
    { id: "u1", name: "Upper Body 1", trainer_id: null },
    { id: "u2", name: "Upper Body Superset 2", trainer_id: null },
    { id: "l1", name: "Lower Body 1", trainer_id: null },
    { id: "l2", name: "Lower Body Superset 2", trainer_id: null },
  ];
  const entry = (program_id: string, created_at = "2026-10-12T08:00:00Z") => ({ program_id, created_at });

  it("marks workouts on the calendar as used", () => {
    const used = usedWorkoutIds([entry("u1"), entry("l1")], [], programs);
    expect([...used].sort()).toEqual(["l1", "u1"]);
    expect(usedInBatch("upperBody", programs, used)).toBe(1);
  });

  it("frees a batch once every workout in it is used", () => {
    const used = usedWorkoutIds([entry("u1"), entry("u2"), entry("l1")], [], programs);
    expect([...used]).toEqual(["l1"]);
  });

  it("only counts workouts added after the batch was reset", () => {
    const resets = [{ batch: "upperBody", reset_at: "2026-10-12T09:00:00Z" }];
    const used = usedWorkoutIds([entry("u1"), entry("l1"), entry("u2", "2026-10-12T10:00:00Z")], resets, programs);
    expect([...used].sort()).toEqual(["l1", "u2"]);
  });

  it("ignores single days of weekly programs", () => {
    const used = usedWorkoutIds([{ ...entry("u1"), day_slot: 3 }, { ...entry("l1"), day_slot: null }], [], programs);
    expect([...used]).toEqual(["l1"]);
  });
});

describe("single days from a program", () => {
  const rows = [
    { id: "a", day_number: 1, week_number: 1 },
    { id: "b", day_number: 3, week_number: 1 },
    { id: "c", day_number: 3, week_number: 2 },
    { id: "d", day_number: 3, week_number: 2 },
  ];

  it("picks one session's exercises, or all of them without a slot", () => {
    expect(exercisesForSlot(rows, 10).map((r) => r.id)).toEqual(["c", "d"]);
    expect(exercisesForSlot(rows, 3).map((r) => r.id)).toEqual(["b"]);
    expect(exercisesForSlot(rows, null)).toHaveLength(4);
  });

  it("lists the training sessions and labels them", () => {
    expect(programSlots(rows)).toEqual([1, 3, 10]);
    const program = { weeks: 2, day_titles: ["Push", "", "Mobility flow", "", "", "", "", "", "", "Hips"] };
    expect(slotLabel(program, 3)).toBe("Week 1 · Wed: Mobility flow");
    expect(slotLabel(program, 10)).toBe("Week 2 · Wed: Hips");
    expect(slotLabel({ weeks: 1, day_titles: [] }, 2)).toBe("Tue");
  });
});

describe("pace", () => {
  it("shortens or lengthens rests but keeps supersets back to back", () => {
    expect(paceRest(75, "faster")).toBe(45);
    expect(paceRest(30, "faster")).toBe(30);
    expect(paceRest(60, "slower")).toBe(90);
    expect(paceRest(120, "slower")).toBe(150);
    // Slower never shortens the coach's rest.
    expect(paceRest(240, "slower")).toBe(240);
    // Faster keeps 90 seconds on heavy compound lifts.
    expect(paceRest(180, "faster", "Barbell Back Squat")).toBe(90);
    expect(paceRest(60, "faster", "Trap Bar Deadlift")).toBe(60);
    expect(paceRest(90, "faster", "Cable Fly")).toBe(45);
    expect(paceRest(0, "slower")).toBe(0);
    expect(paceRest(75, "planned")).toBe(75);
  });

  it("leaves cardio blocks alone", () => {
    const rows = [
      { id: "a", kind: "exercise", rest_seconds: 60 },
      { id: "b", kind: "cardio", rest_seconds: 0 },
    ] as ProgramExercise[];
    expect(withPace(rows, "faster").map((r) => r.rest_seconds)).toEqual([45, 0]);
  });
});

describe("applyMoves", () => {
  it("moves a caught-up workout to the day it was done", () => {
    const { labels, moves } = applyMoves({ "2026-10-15": "Upper SS 2", "2026-10-16": "Lower 3" }, [
      { session_date: "2026-10-17", makeup_for: "2026-10-15" },
      { session_date: "2026-10-16", makeup_for: null },
    ]);
    expect(labels["2026-10-17"]).toBe("Upper SS 2");
    expect(moves).toEqual({ "2026-10-15": "missed", "2026-10-17": "caughtUp" });
  });
});

describe("calendarDayLabels", () => {
  const programs: Record<string, { name: string; trainer_id: string | null }> = {
    train: { name: "Intermediate Foundation - Bodybuilding", trainer_id: null },
    flex: { name: "Flexibility 4 – Lower Back Release", trainer_id: null },
    mob: { name: "Mobility 1 – Hips", trainer_id: null },
    hiit: { name: "HIIT 3", trainer_id: null },
  };
  const label = (p: { name: string; trainer_id: string | null }) => p.name.split(" ")[0];

  it("keeps mobility and flexibility apart from the training, as the workout or an extra", () => {
    const { labels, functional } = calendarDayLabels(
      [
        { workout_date: "2026-10-19", program_id: "train" },
        { workout_date: "2026-10-20", program_id: "flex" },
      ],
      [
        { workout_date: "2026-10-19", program_id: "flex" },
        { workout_date: "2026-10-19", program_id: "hiit" },
        { workout_date: "2026-10-19", program_id: "mob" },
        { workout_date: "2026-10-21", program_id: "gone" },
      ],
      (id) => programs[id],
      label,
    );
    expect(labels).toEqual({ "2026-10-19": "Intermediate +1" });
    expect(functional).toEqual({ "2026-10-19": "Flexibility +1", "2026-10-20": "Flexibility" });
  });

  it("marks a deload week's workout", () => {
    const { labels } = calendarDayLabels([{ workout_date: "2026-10-26", program_id: "train", deload: true }], [], (id) => programs[id], label);
    expect(labels).toEqual({ "2026-10-26": "🌙 Deload" });
  });

  it("shortens functional names for a cell", () => {
    expect(functionalShortName("Flexibility 4 – Lower Back Release")).toBe("Flex 4");
    expect(functionalShortName("Flexibility 4 – Lower Back Release", false)).toBe("Flexibility");
  });
});

describe("week view", () => {
  it("finds the Monday and the 7 days of a week", () => {
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(mondayOf("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekDates("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(weekLabel("2026-10-19")).toBe("19 – 25 Oct");
    expect(weekLabel("2026-10-26")).toBe("26 Oct – 1 Nov");
  });

  it("names the body parts a workout trains, most first", () => {
    expect(bodyPartsLabel(["Triceps", "Chest", "Chest", null, "Chest", "Triceps", "Shoulders", "Abs"])).toBe("Chest · Triceps · Shoulders");
    expect(bodyPartsLabel([])).toBe("");
  });
});
