import { describe, expect, it } from "vitest";
import { adjustWeight, apreBase, apreNextSet, apreRestAfter, isApre, type ApreSet } from "./apre";
import { repRange } from "./progression";

const bench = { name: "Bench Press", category: "Push" };
const squat = { name: "Barbell Back Squat", category: "Legs" };
const set = (set_number: number, weight_kg: number, reps: number): ApreSet => ({ set_number, weight_kg, reps, effort: "failure" });
const session = (base: number, allOut: number[]) => [set(1, base / 2, 12), set(2, base * 0.75, 10), ...allOut.map((r, i) => set(3 + i, base, r))];

describe("APRE", () => {
  it("knows its rows, and the double progression leaves them alone", () => {
    expect(isApre("APRE: 10-12, 8-10, 7+")).toBe(true);
    expect(isApre("8-10")).toBe(false);
    expect(repRange("APRE: 10-12, 8-10, 7+")).toBeNull();
  });

  it("moves the weight by the all-out reps", () => {
    expect(adjustWeight(100, 7, squat)).toBe(105);
    expect(adjustWeight(100, 6, squat)).toBe(100);
    expect(adjustWeight(100, 5, squat)).toBe(100);
    expect(adjustWeight(100, 4, squat)).toBe(95);
    expect(adjustWeight(100, 4, squat, false)).toBe(100);
    // Never less than one step of the gym's weights.
    expect(adjustWeight(40, 9, bench)).toBe(42.5);
  });

  it("works out today's 7-rep weight from last time", () => {
    expect(apreBase([], bench).base).toBeNull();
    expect(apreBase([session(80, [8])], bench).base).toBe(85);
    expect(apreBase([session(80, [6])], bench).base).toBe(80);
    // Under 5 once: the same. Twice in a row: 5% less.
    expect(apreBase([session(80, [4]), session(80, [6])], bench).base).toBe(80);
    expect(apreBase([session(80, [4]), session(80, [3])], bench).base).toBe(75);
    // With a fourth set, the last all-out set counts.
    expect(apreBase([[...session(80, [8]).slice(0, 3), set(4, 85, 5)]], bench).base).toBe(85);
  });

  it("plans each set: 50%, 75%, then all-out", () => {
    expect(apreNextSet(80, [], 3, bench).weight).toBe(40);
    expect(apreNextSet(80, [set(1, 40, 12)], 3, bench).weight).toBe(60);
    const s3 = apreNextSet(80, [set(1, 40, 12), set(2, 60, 10)], 3, bench);
    expect(s3.weight).toBe(80);
    expect(s3.advice).toContain("as many clean reps");
    expect(apreNextSet(80, session(80, [7]), 3, bench).last).toContain("all sets done");
  });

  it("the first time, the 7-rep weight comes from set 1", () => {
    expect(apreNextSet(null, [], 3, bench).weight).toBeNull();
    expect(apreNextSet(null, [set(1, 30, 12)], 3, bench).weight).toBe(45);
    expect(apreNextSet(null, [set(1, 30, 12), set(2, 45, 10)], 3, bench).weight).toBe(60);
  });

  it("set 4 moves with set 3's reps", () => {
    const three = session(100, [8]);
    expect(apreNextSet(100, three, 4, squat).weight).toBe(105);
    expect(apreNextSet(100, session(100, [3]), 4, squat).weight).toBe(95);
  });

  it("rests 1, 2 then 3 minutes", () => {
    expect([1, 2, 3].map((n) => apreRestAfter(n, 4, 120))).toEqual([60, 120, 180]);
    expect(apreRestAfter(3, 3, 120)).toBe(120);
  });
});
