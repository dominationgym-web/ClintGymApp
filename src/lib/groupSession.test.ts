import { describe, expect, it } from "vitest";
import { clientSets, nextSetNumber, setsByClient, slotFor, startWeight } from "@/lib/groupSession";

const log = (client_id: string, exercise_name: string, set_number: number, weight_kg: number | null = 20, warm_up = false) => ({
  client_id,
  exercise_name,
  set_number,
  weight_kg,
  reps: 10,
  warm_up,
});

describe("group session", () => {
  const logs = [log("a", "Bench press", 1, 40), log("b", "Bench press", 1, 30), log("a", "Bench press", 2, 42.5), log("a", "Bench press", 0, 20, true)];

  it("gives each client their own colour and letter", () => {
    expect([0, 1, 2, 3].map((i) => slotFor(i).letter)).toEqual(["A", "B", "C", "D"]);
    expect(new Set([0, 1, 2, 3].map((i) => slotFor(i).color)).size).toBe(4);
  });

  it("keeps each client's sets apart", () => {
    expect(clientSets(logs, "a", "Bench press").map((l) => l.weight_kg)).toEqual([40, 42.5]);
    expect(clientSets(logs, "b", "Bench press").map((l) => l.weight_kg)).toEqual([30]);
    expect(nextSetNumber(logs, "a", "Bench press")).toBe(3);
    expect(nextSetNumber(logs, "b", "Bench press")).toBe(2);
    expect(nextSetNumber(logs, "c", "Bench press")).toBe(1);
    expect(setsByClient(logs, ["a", "b", "c"])).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("starts at the client's own last weight", () => {
    expect(startWeight(logs, [], "a", "Bench press")).toBe("42.5");
    expect(startWeight([], [log("b", "Bench press", 3, 35)], "b", "Bench press")).toBe("35");
    expect(startWeight(logs, [log("a", "Squat", 1, 80)], "b", "Squat")).toBe("");
  });
});

import { addSteps, stationsOf, stepsFromPlan, supersetNext, type GroupStep } from "@/lib/groupSession";

const row = (name: string, rest = 90, sets = 3) => ({ exercise_id: name, exercise_name: name, sets, reps: "8-12", rest_seconds: rest, kind: "exercise" });
const lg = (client_id: string, exercise_name: string, set_number: number, warm_up = false) =>
  ({ client_id, exercise_name, set_number, warm_up, weight_kg: 10, reps: 10 });

describe("group session pages (one flow)", () => {
  it("turns rest-0 runs in the plan into a superset", () => {
    const steps = stepsFromPlan([row("Squat"), row("Bench", 0), row("Row"), row("Curl")]);
    expect(steps.map((s) => !!s.group)).toEqual([false, true, true, false]);
    expect(stationsOf(steps, 2)).toEqual([1, 2]);
    expect(stationsOf(steps, 0)).toEqual([0]);
  });

  it("adds single exercises as pages, and jumps to one already there", () => {
    const base: GroupStep[] = [{ id: "a", name: "Squat", sets: 3, reps: "5", group: null }];
    expect(addSteps(base, [{ id: "b", name: "Bench" }, { id: "c", name: "Row" }], false, "g").steps.map((s) => s.name)).toEqual(["Squat", "Bench", "Row"]);
    expect(addSteps(base, [{ id: "a", name: "Squat" }], false, "g")).toEqual({ steps: base, index: 0 });
  });

  it("adds a superset any time, pulling in exercises already in the session", () => {
    const base: GroupStep[] = [
      { id: "a", name: "Squat", sets: 4, reps: "5", group: null },
      { id: "b", name: "Bench", sets: 3, reps: "8", group: null },
    ];
    const { steps, index } = addSteps(base, [{ id: "a", name: "Squat" }, { id: "c", name: "Row" }], true, "g1");
    expect(steps.map((s) => `${s.name}:${s.group}`)).toEqual(["Bench:null", "Squat:g1", "Row:g1"]);
    expect(steps[1].sets).toBe(4);
    expect(index).toBe(1);
  });

  it("moves through the superset stations once everyone has done the round", () => {
    const steps: GroupStep[] = [
      { id: "1", name: "Press", sets: 2, reps: "8", group: "g" },
      { id: "2", name: "Row", sets: 2, reps: "8", group: "g" },
      { id: "3", name: "Curl", sets: 3, reps: "8", group: null },
    ];
    const ab = ["A", "B"];
    // Only A has done station 1: stay.
    expect(supersetNext(steps, 0, [lg("A", "Press", 1)], ab)).toBeNull();
    // Both done station 1: go to station 2. A warm-up doesn't count.
    expect(supersetNext(steps, 0, [lg("A", "Press", 0, true), lg("A", "Press", 1), lg("B", "Press", 1)], ab)).toBe(1);
    // Both done round 1 of station 2: back to station 1.
    const r1 = [lg("A", "Press", 1), lg("B", "Press", 1), lg("A", "Row", 1), lg("B", "Row", 1)];
    expect(supersetNext(steps, 1, r1, ab)).toBe(0);
    // Both done round 2 (the last): on to the next exercise.
    const r2 = [...r1, lg("A", "Press", 2), lg("B", "Press", 2), lg("A", "Row", 2), lg("B", "Row", 2)];
    expect(supersetNext(steps, 1, r2, ab)).toBe(2);
    // A normal exercise never jumps.
    expect(supersetNext(steps, 2, r2, ab)).toBeNull();
  });
});
