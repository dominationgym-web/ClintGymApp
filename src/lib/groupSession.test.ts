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

import { addSteps, blockOfStep, blocksOf, nextBehind, roundsDone, stationsOf, stepsFromPlan, type GroupStep } from "@/lib/groupSession";

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

  it("groups pages into blocks and finds who is behind", () => {
    const steps: GroupStep[] = [
      { id: "1", name: "Squat", sets: 3, reps: "5", group: null },
      { id: "2", name: "Press", sets: 2, reps: "8", group: "g" },
      { id: "3", name: "Row", sets: 2, reps: "8", group: "g" },
      { id: "4", name: "Curl", sets: 3, reps: "8", group: null },
    ];
    expect(blocksOf(steps)).toEqual([[0], [1, 2], [3]]);
    expect(blockOfStep(steps, 2)).toBe(1);
    const logs = [lg("A", "Press", 1), lg("A", "Row", 1), lg("B", "Press", 1), lg("C", "Press", 0, true)];
    // B did Press but not Row, so B hasn't finished round 1.
    expect(roundsDone(logs, "A", ["Press", "Row"])).toBe(1);
    expect(roundsDone(logs, "B", ["Press", "Row"])).toBe(0);
    expect(nextBehind(["A", "B", "C"], "A", logs, ["Press", "Row"])).toBe("B");
    expect(nextBehind(["A", "B", "C"], "B", logs, ["Press", "Row"])).toBeNull();
  });
});
