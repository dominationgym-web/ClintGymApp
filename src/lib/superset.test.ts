import { describe, expect, it } from "vitest";
import { lastWeightOf, roundProblem, supersetRest, supersetRounds, workingSetsOf, type SupersetPick } from "@/lib/superset";

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
