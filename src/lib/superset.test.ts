import { describe, expect, it } from "vitest";
import { lastWeightOf, roundProblem, setupFor, stationsSummary, supersetGroups, supersetRest, supersetRounds, warmUpEntry, warmUpPicks, workingSetsOf, type SupersetPick } from "@/lib/superset";

const bench: SupersetPick = { exercise_id: "b", exercise_name: "Bench Press", row: { sets: 4, reps: "8", rest_seconds: 0 } };
const row: SupersetPick = { exercise_id: "r", exercise_name: "Chest-Supported Row", row: { sets: 3, reps: "10", rest_seconds: 120 } };
const curl: SupersetPick = { exercise_id: null, exercise_name: "Hammer Curl", row: null };

describe("superset", () => {
  it("does as many rounds as the exercise with the most sets, else 3", () => {
    expect(supersetRounds([bench, row])).toBe(4);
    expect(supersetRounds([curl, { ...curl, exercise_name: "Dip" }])).toBe(3);
  });
  it("rests the longest rest of the picked exercises, else 90 seconds", () => {
    expect(supersetRest([bench, row])).toBe(120);
    expect(supersetRest([curl, bench])).toBe(90);
  });
  it("counts today's working sets by id, or by name without one", () => {
    const logs = [
      { exercise_id: "b", exercise_name: "Bench Press", warm_up: false },
      { exercise_id: "b", exercise_name: "Bench Press", warm_up: true },
      { exercise_id: null, exercise_name: "Hammer Curl", warm_up: false },
    ];
    expect(workingSetsOf(bench, logs)).toBe(1);
    expect(workingSetsOf(curl, logs)).toBe(1);
    expect(workingSetsOf(row, logs)).toBe(0);
  });
  it("starts from the latest weight logged", () => {
    const logs = [
      { exercise_id: "b", exercise_name: "Bench Press", weight_kg: 60, log_date: "2026-10-20", created_at: "2026-10-20T08:00:00Z" },
      { exercise_id: "b", exercise_name: "Bench Press", weight_kg: 62.5, log_date: "2026-10-23", created_at: "2026-10-23T08:00:00Z" },
      { exercise_id: "b", exercise_name: "Bench Press", weight_kg: null, log_date: "2026-10-23", created_at: "2026-10-23T09:00:00Z" },
    ];
    expect(lastWeightOf(bench, logs)).toBe(62.5);
    expect(lastWeightOf(row, logs)).toBeNull();
  });
  it("needs reps for at least one exercise, and the effort for each one done", () => {
    expect(roundProblem([bench, row], [{ weight: "", reps: "", effort: null }, { weight: "", reps: "", effort: null }])).toMatch(/at least one/);
    expect(roundProblem([bench, row], [{ weight: "60", reps: "8", effort: null }, { weight: "", reps: "", effort: null }])).toMatch(/Bench Press/);
    expect(roundProblem([bench, row], [{ weight: "60", reps: "x", effort: "comfortable" }, { weight: "", reps: "", effort: null }])).toMatch(/reps/);
    expect(roundProblem([bench, row], [{ weight: "60", reps: "8", effort: "comfortable" }, { weight: "", reps: "", effort: null }])).toBeNull();
  });
});

describe("superset warm-up round", () => {
  const pick = (name: string, reps = "8-10"): SupersetPick => ({ exercise_id: name, exercise_name: name, row: { sets: 3, reps, rest_seconds: 0 } });
  const cat: Record<string, string> = { Bench: "Chest", Fly: "Chest", Row: "Back", Plank: "Core" };
  const categoryOf = (p: SupersetPick) => cat[p.exercise_name] ?? null;
  it("warms up each body part once, never core, and skips what's done today", () => {
    expect(warmUpPicks([pick("Bench"), pick("Row")], categoryOf, [], [])).toEqual([true, true]);
    expect(warmUpPicks([pick("Bench"), pick("Fly")], categoryOf, [], [])).toEqual([true, false]);
    expect(warmUpPicks([pick("Bench"), pick("Plank")], categoryOf, [], [])).toEqual([true, false]);
    expect(warmUpPicks([pick("Bench"), pick("Row")], categoryOf, [], ["Chest"])).toEqual([false, true]);
    expect(warmUpPicks([pick("Bench"), pick("Row")], categoryOf, [{ exercise_id: "Row", exercise_name: "Row" }], [])).toEqual([true, false]);
  });
  it("fills in half the weight and capped reps", () => {
    expect(warmUpEntry(pick("Bench", "12-15"), 60)).toEqual({ weight: "30", reps: "10", effort: "comfortable" });
    expect(warmUpEntry({ ...pick("Bench"), row: null }, null)).toEqual({ weight: "", reps: "", effort: "comfortable" });
  });
});

describe("superset heads-up", () => {
  const r = (id: string, exercise_name: string, rest_seconds: number, sets = 3, kind: "exercise" | "cardio" = "exercise") => ({
    id,
    exercise_name,
    sets,
    reps: "10",
    rest_seconds,
    kind,
  });
  it("finds 2- and 3-station supersets and skips plain exercises", () => {
    const groups = supersetGroups([
      r("a", "Barbell Bench Press", 0, 4),
      r("b", "Dumbbell Row", 120),
      r("c", "Leg Press", 90),
      r("d", "Cable Fly", 0),
      r("e", "Push-Up", 0),
      r("f", "Dip", 60),
    ]);
    expect(groups.map((g) => g.rows.map((x) => x.id))).toEqual([["a", "b"], ["d", "e", "f"]]);
    expect(groups[0].rounds).toBe(4);
    expect(groups[1].restAfter).toBe(60);
    expect(stationsSummary(groups)).toBe("2 and 3 stations");
    expect(stationsSummary([groups[0]])).toBe("2 stations");
  });
  it("lets cardio break a run", () => {
    expect(supersetGroups([r("a", "Squat", 0), r("x", "Bike", 0, 1, "cardio"), r("b", "Lunge", 90)])).toEqual([]);
  });
  it("says what to set up", () => {
    expect(setupFor("Incline Dumbbell Press")).toEqual(["Dumbbells", "Incline bench"]);
    expect(setupFor("Barbell Bench Press")).toEqual(["Barbell", "Bench"]);
    expect(setupFor("Cable Tricep Pushdown")).toEqual(["Cable machine"]);
    expect(setupFor("Goblet Squat")).toEqual(["Dumbbell or kettlebell"]);
    expect(setupFor("Dumbbell Goblet Reverse Lunge")).toEqual(["Dumbbells"]);
    expect(setupFor("Pull-Up")).toEqual(["Pull-up bar"]);
    expect(setupFor("Push-Up")).toEqual([]);
  });
});
