import { describe, expect, it } from "vitest";
import { buildIntervals, hasIntervals, isDistance, leadingSeconds, parseRepeats } from "./intervalTimer";

const row = (id: string, exercise_name: string, sets: number, reps: string, rest_seconds: number, kind: "exercise" | "cardio" = "exercise") =>
  ({ id, kind, exercise_name, sets, reps, rest_seconds });

describe("reading the times", () => {
  it("reads seconds and minutes from the start of the reps", () => {
    expect(leadingSeconds("30 sec all-out")).toBe(30);
    expect(leadingSeconds("3 min round at 7/10")).toBe(180);
    expect(leadingSeconds("30 sec each leg")).toBe(60);
    expect(leadingSeconds("10")).toBeNull();
    expect(leadingSeconds("8-10")).toBeNull();
  });
  it("spots distances and repeats", () => {
    expect(isDistance("250 m hard (85-90%)")).toBe(true);
    expect(isDistance("5 min easy")).toBe(false);
    expect(parseRepeats("3 x 10 min at threshold (7/10) / 3 min easy")).toMatchObject({ rounds: 3, work: 600, easy: 180 });
    expect(parseRepeats("5 x 5 min at threshold pace / 1 min walk")).toMatchObject({ rounds: 5, work: 300, easy: 60 });
  });
});

describe("buildIntervals", () => {
  it("runs sprints with the rest between them and a cool down", () => {
    const phases = buildIntervals([
      row("a", "Assault Bike", 3, "30 sec all-out", 240),
      row("c", "Cycle", 1, "5 min easy spin to cool down", 0, "cardio"),
    ]);
    expect(phases.map((p) => `${p.kind}:${p.seconds}`)).toEqual(["work:30", "easy:240", "work:30", "easy:240", "work:30", "easy:300"]);
    expect(phases.filter((p) => p.countsAsSet)).toHaveLength(3);
  });
  it("runs a circuit station to station, resting after each round", () => {
    const phases = buildIntervals([
      row("a", "Assault Bike", 2, "30 sec hard", 0),
      row("b", "SkiErg", 2, "30 sec hard", 90),
    ]);
    expect(phases.map((p) => `${p.name}:${p.kind}`)).toEqual([
      "Assault Bike:work",
      "SkiErg:work",
      "SkiErg:easy",
      "Assault Bike:work",
      "SkiErg:work",
    ]);
  });
  it("leaves distance efforts open and skips rep-counted lifts", () => {
    const phases = buildIntervals([row("s", "Back Squat", 3, "5", 120), row("r", "Rowing Sprint", 2, "250 m hard", 90)]);
    expect(phases.map((p) => `${p.name}:${p.seconds}`)).toEqual(["Rowing Sprint:null", "Rowing Sprint:90", "Rowing Sprint:null"]);
  });
  it("is only offered when the workout has timed work", () => {
    expect(hasIntervals([row("s", "Back Squat", 3, "5", 120)])).toBe(false);
    expect(hasIntervals([row("a", "Assault Bike", 3, "30 sec", 60)])).toBe(true);
    expect(hasIntervals([row("t", "Treadmill", 1, "5 x 5 min at threshold pace / 1 min walk", 0, "cardio")])).toBe(true);
  });
});
