import { describe, expect, it } from "vitest";
import {
  applyRecoveryAdjustment,
  findRecoveryClash,
  groupList,
  lighterSets,
  muscleGroupsFor,
  recoveryHandled,
  setsByGroup,
  yesterdayOf,
} from "./recovery";
import type { ProgramExercise } from "@/types/database";

const CATEGORIES: Record<string, string> = {
  bench: "Push",
  row: "Pull",
  squat: "Legs",
  curl: "Biceps",
  calf: "Calves",
  run: "Cardio",
};
const categoryOf = (id: string | null) => (id ? CATEGORIES[id] : null);

const row = (id: string, exercise_id: string, sets = 4, kind: "exercise" | "cardio" = "exercise"): ProgramExercise => ({
  id,
  program_id: "p",
  day_number: 1,
  sort_order: 1,
  exercise_id,
  exercise_name: exercise_id,
  sets,
  reps: "10",
  rest_seconds: 90,
  kind,
});

const logs = (exercise_id: string, n: number) => Array.from({ length: n }, () => ({ exercise_id }));

describe("recovery check", () => {
  it("maps exercise categories to muscle groups, ignoring quick-recovery ones", () => {
    expect(muscleGroupsFor("Push")).toEqual(["Chest", "Triceps"]);
    expect(muscleGroupsFor("Posterior Chain")).toEqual(["Legs"]);
    expect(muscleGroupsFor("Calves")).toEqual([]);
    expect(muscleGroupsFor(null)).toEqual([]);
  });

  it("counts yesterday's sets per muscle group", () => {
    expect(setsByGroup([...logs("bench", 3), ...logs("curl", 2)], categoryOf)).toEqual({ Chest: 3, Triceps: 3, Biceps: 2 });
  });

  it("flags today's exercises that work muscles trained hard yesterday", () => {
    const yesterday = setsByGroup(logs("bench", 4), categoryOf);
    const clash = findRecoveryClash([row("a", "bench"), row("b", "squat"), row("c", "row")], yesterday, categoryOf);
    expect(clash?.groups).toEqual(["Chest", "Triceps"]);
    expect(clash?.rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("counts arms the day after a back day", () => {
    const clash = findRecoveryClash([row("a", "curl")], setsByGroup(logs("row", 3), categoryOf), categoryOf);
    expect(clash?.groups).toEqual(["Biceps"]);
  });

  it("ignores a couple of light sets, cardio and other muscles", () => {
    expect(findRecoveryClash([row("a", "bench")], setsByGroup(logs("bench", 2), categoryOf), categoryOf)).toBeNull();
    expect(findRecoveryClash([row("a", "squat")], setsByGroup(logs("bench", 5), categoryOf), categoryOf)).toBeNull();
    expect(findRecoveryClash([row("a", "calf")], setsByGroup(logs("calf", 6), categoryOf), categoryOf)).toBeNull();
    expect(findRecoveryClash([row("a", "run", 1, "cardio")], setsByGroup(logs("squat", 6), categoryOf), categoryOf)).toBeNull();
  });

  it("suggests about half the sets, at least one", () => {
    const clash = { groups: ["Chest" as const], rows: [row("a", "bench", 4), row("b", "bench", 3), row("c", "bench", 1)] };
    expect(lighterSets(clash)).toEqual({ a: 2, b: 2, c: 1 });
  });

  it("applies the trainer's lighter session only on its date, dropping skipped exercises", () => {
    const rows = [row("a", "bench", 4), row("b", "squat", 4)];
    const assignment = { recovery_adjustment: { date: "2026-10-11", sets: { a: 0, b: 2 } } };
    expect(applyRecoveryAdjustment(rows, assignment, "2026-10-11").map((r) => [r.id, r.sets])).toEqual([["b", 2]]);
    expect(applyRecoveryAdjustment(rows, assignment, "2026-10-12")).toBe(rows);
    expect(applyRecoveryAdjustment(rows, { recovery_adjustment: null }, "2026-10-11")).toBe(rows);
  });

  it("knows when the trainer has dealt with today's check", () => {
    expect(recoveryHandled({ recovery_ignored_on: "2026-10-11", recovery_adjustment: null }, "2026-10-11")).toBe(true);
    expect(recoveryHandled({ recovery_ignored_on: "2026-10-10", recovery_adjustment: null }, "2026-10-11")).toBe(false);
    expect(
      recoveryHandled({ recovery_ignored_on: null, recovery_adjustment: { date: "2026-10-11", sets: {} } }, "2026-10-11"),
    ).toBe(true);
  });

  it("writes the muscle list and yesterday's date", () => {
    expect(groupList(["Chest"])).toBe("Chest");
    expect(groupList(["Chest", "Triceps"])).toBe("Chest and triceps");
    expect(groupList(["Back", "Biceps", "Legs"])).toBe("Back, biceps and legs");
    expect(yesterdayOf("2026-10-01")).toBe("2026-09-30");
  });
});
