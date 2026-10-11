import { describe, expect, it } from "vitest";
import { repRange, suggestNext, weightStep, type LoggedSet } from "./progression";

const sets = (weight: number, reps: number[], effort: LoggedSet["effort"] = "close_to_failure"): LoggedSet[] =>
  reps.map((r) => ({ weight_kg: weight, reps: r, effort }));
const bench = { name: "Barbell Bench Press", category: "Push" };
const squat = { name: "Barbell Back Squat", category: "Legs" };

describe("repRange", () => {
  it("reads ranges and single numbers, not timed work", () => {
    expect(repRange("8-10")).toEqual({ low: 8, high: 10 });
    expect(repRange("12")).toEqual({ low: 12, high: 12 });
    expect(repRange("40 sec")).toBeNull();
    expect(repRange("8 x 20 sec all-out / 10 sec easy")).toBeNull();
    expect(repRange(null)).toBeNull();
  });
});

describe("weightStep", () => {
  it("adds 5kg on big lower-body lifts and 2.5kg elsewhere", () => {
    expect(weightStep(squat)).toBe(5);
    expect(weightStep({ name: "Leg Press", category: "Legs" })).toBe(5);
    expect(weightStep({ name: "Dumbbell Goblet Squat", category: "Legs" })).toBe(2.5);
    expect(weightStep(bench)).toBe(2.5);
  });
});

describe("suggestNext", () => {
  it("adds weight once every set hits the top of the range", () => {
    const s = suggestNext(sets(40, [10, 10, 10]), "8-10", bench);
    expect(s?.last).toBe("Last time: 40kg × 10, 10, 10");
    expect(s?.weight).toBe(42.5);
  });
  it("holds the weight when a set went to failure", () => {
    expect(suggestNext(sets(40, [10, 10, 10], "failure"), "8-10", bench)?.weight).toBe(40);
  });
  it("holds the weight while working up the range", () => {
    const s = suggestNext(sets(100, [10, 9, 8]), "8-10", squat);
    expect(s?.weight).toBe(100);
    expect(s?.advice).toContain("beat last time");
  });
  it("only counts the heaviest sets as working sets", () => {
    const s = suggestNext([...sets(20, [20], "comfortable"), ...sets(60, [6, 6])], "4-6", squat);
    expect(s?.last).toBe("Last time: 60kg × 6, 6");
    expect(s?.weight).toBe(65);
  });
  it("says to hit the range when sets fell short", () => {
    expect(suggestNext(sets(40, [7, 6]), "8-10", bench)?.advice).toContain("8-10 reps");
  });
  it("goes by effort when there's no rep range", () => {
    expect(suggestNext(sets(20, [12, 12], "comfortable"), null, bench)?.weight).toBe(22.5);
    expect(suggestNext(sets(20, [12, 12]), null, bench)?.weight).toBe(20);
  });
  it("has nothing to say without logged weights", () => {
    expect(suggestNext([{ weight_kg: null, reps: 15, effort: "comfortable" }], "12-15", bench)).toBeNull();
  });
});
