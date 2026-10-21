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
