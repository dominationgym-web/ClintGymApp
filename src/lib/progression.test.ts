import { describe, expect, it } from "vitest";
import { EFFORT_OPTIONS, heavyCompound, heavyLowerOrSpine, repRange, repsLeftFor, suggestNext, weightStep, type LoggedSet } from "./progression";

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
  it("reads the leading numbers of one-side and slow reps", () => {
    expect(repRange("12-15 each side")).toEqual({ low: 12, high: 15 });
    expect(repRange("10 each leg")).toEqual({ low: 10, high: 10 });
    expect(repRange("4-6 slow")).toEqual({ low: 4, high: 6 });
    expect(repRange("15-20, light and slow")).toEqual({ low: 15, high: 20 });
    expect(repRange("8-10, 3 seconds down")).toEqual({ low: 8, high: 10 });
    expect(repRange("5, last set: test your best clean 5 (1-2 reps left)")).toEqual({ low: 5, high: 5 });
  });
  it("leaves out timed work, distances, jumps and holds", () => {
    expect(repRange("30 sec each side")).toBeNull();
    expect(repRange("20 m")).toBeNull();
    expect(repRange("40 m heavy")).toBeNull();
    expect(repRange("12 min easy pace")).toBeNull();
    expect(repRange("1 run (5-10-5)")).toBeNull();
    expect(repRange("3, step down")).toBeNull();
    expect(repRange("6 explosive each side")).toBeNull();
    expect(repRange("8 each side, hold 3 sec")).toBeNull();
    expect(repRange("4 slow circles each way, each arm")).toBeNull();
    expect(repRange("3 heavy, rest 3 min, then the jump")).toBeNull();
    expect(repRange("8% incline: 10/20/30 sec sprints")).toBeNull();
  });
});

describe("weightStep", () => {
  it("adds 5kg on big lower-body lifts and 2.5kg elsewhere", () => {
    expect(weightStep(squat)).toBe(5);
    expect(weightStep({ name: "Leg Press", category: "Legs" })).toBe(5);
    expect(weightStep(bench)).toBe(2.5);
  });
  it("uses real dumbbell and kettlebell steps", () => {
    expect(weightStep({ name: "Dumbbell Goblet Squat", category: "Legs" })).toBe(2);
    expect(weightStep({ name: "Dumbbell Lateral Raise", category: "Shoulders" }, 6)).toBe(2);
    expect(weightStep({ name: "Dumbbell Bench Press", category: "Chest" }, 20)).toBe(2.5);
    expect(weightStep({ name: "Kettlebell Romanian Deadlift", category: "Hamstrings" }, 16)).toBe(4);
  });
  it("suggests a dumbbell weight that exists, after adding reps first when the jump is big", () => {
    const raise = { name: "Dumbbell Lateral Raise", category: "Shoulders" };
    const first = suggestNext(sets(6, [15, 15, 15]), "12-15", raise);
    expect(first?.weight).toBe(6);
    expect(first?.advice).toContain("add reps first");
    expect(first?.advice).toContain("17 reps");
    expect(suggestNext(sets(6, [17, 17, 17]), "12-15", raise)?.weight).toBe(8);
  });
});

describe("heavy lifts", () => {
  it("spots heavy lower-body, spine-loading and compound lifts", () => {
    expect(heavyLowerOrSpine("Barbell Back Squat")).toBe(true);
    expect(heavyLowerOrSpine("Romanian Deadlift")).toBe(true);
    expect(heavyLowerOrSpine("Walking Lunges")).toBe(true);
    expect(heavyLowerOrSpine("Jump Squat")).toBe(false);
    expect(heavyLowerOrSpine("Leg Extension")).toBe(false);
    expect(heavyCompound("Barbell Bench Press")).toBe(true);
    expect(heavyCompound("Trap Bar Deadlift")).toBe(true);
    expect(heavyCompound("Cable Lateral Raise")).toBe(false);
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
  it("never jumps more than about 10% at once", () => {
    const kb = { name: "Kettlebell Goblet Squat", category: "Legs" };
    expect(suggestNext(sets(16, [10, 10, 10]), "8-10", kb)?.weight).toBe(16);
    expect(suggestNext(sets(16, [12, 12], "comfortable"), null, kb)?.advice).toContain("Add a rep or two");
    expect(suggestNext(sets(20, [12, 12], "comfortable"), null, { name: "Dumbbell Bench Press", category: "Chest" })?.weight).toBe(22.5);
  });
  it("works out a new weight when the program's rep range changes", () => {
    // 6-8 last week, 10-12 this week: 100 × 8 (1-2 left) → about 130kg max → 130 / 1.433 ≈ 90.7 → 90kg.
    const down = suggestNext(sets(100, [8, 8, 8]), "10-12", squat);
    expect(down?.weight).toBe(90);
    expect(down?.advice).toContain("Go down to 90kg");
    // 10-12 last week, 6-8 this week: 80 × 12 → 112kg max (12 reps at most) → 112 / 1.3 ≈ 86.2 → 85kg.
    expect(suggestNext(sets(80, [12, 12, 12]), "6-8", squat)?.weight).toBe(85);
    // Strength 12-week 5-6 → 3-5: a normal step up.
    expect(suggestNext(sets(100, [6, 6, 6]), "3-5", squat)?.weight).toBe(105);
  });
  it("keeps the client's own safety margin in the new weight", () => {
    // Intro: 2 reps in reserve gives a lighter weight than 1.
    expect(suggestNext(sets(100, [8, 8, 8]), "10-12", squat, 2)?.weight).toBe(85);
  });
  it("logs effort as reps left", () => {
    expect(EFFORT_OPTIONS.map((o) => o.label)).toEqual(["0 (failure)", "1-2 left", "3+ left"]);
    expect(repsLeftFor("failure")).toBe(0);
    expect(repsLeftFor("comfortable")).toBe(3);
  });
  it("has nothing to say without logged weights", () => {
    expect(suggestNext([{ weight_kg: null, reps: 15, effort: "comfortable" }], "12-15", bench)).toBeNull();
  });
});
