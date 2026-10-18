import { describe, expect, it } from "vitest";
import {
  clockSeconds,
  compareRound,
  dropPlanText,
  dropRange,
  formatRoundTime,
  isDropSetProgram,
  needsLevelNote,
  newClock,
  pauseClock,
  roundsForLevel,
  startClock,
} from "./dropSets";

describe("drop sets", () => {
  it("spots built-in drop set programs", () => {
    expect(isDropSetProgram({ name: "Drop Set Chest 2", trainer_id: null })).toBe(true);
    expect(isDropSetProgram({ name: "Drop Set Chest 2", trainer_id: "t" })).toBe(false);
    expect(isDropSetProgram({ name: "Chest & Bi 1", trainer_id: null })).toBe(false);
    expect(isDropSetProgram(null)).toBe(false);
  });
  it("gives 3 rounds to advanced, 2 to everyone else", () => {
    expect(roundsForLevel("advanced")).toBe(3);
    expect(roundsForLevel("intermediate")).toBe(2);
    expect(roundsForLevel(null)).toBe(2);
    expect(needsLevelNote("beginner")).toBe(true);
    expect(needsLevelNote(null)).toBe(true);
    expect(needsLevelNote("intermediate")).toBe(false);
  });
  it("uses 4-6 drops, all short of failure on Smith squats and leg presses", () => {
    expect(dropRange("Leg Press")).toEqual({ min: 4, max: 6, toFailure: false });
    expect(dropRange("Smith Machine Squat")).toEqual({ min: 4, max: 6, toFailure: false });
    expect(dropRange("Cable Curl")).toEqual({ min: 4, max: 6, toFailure: true });
    expect(dropPlanText(2, dropRange("Cable Curl"))).toContain("4-6 drops of about 10-15%");
    expect(dropPlanText(2, dropRange("Leg Press"))).toContain("never to failure");
  });
  it("adds up time only while the clock runs", () => {
    let c = startClock(newClock(), 0);
    c = pauseClock(c, 10_000); // typing the next weight
    expect(clockSeconds(c, 50_000)).toBe(10);
    c = startClock(c, 50_000); // tapped Log
    c = startClock(c, 52_000); // a second start changes nothing
    expect(clockSeconds(c, 55_500)).toBe(15);
    c = pauseClock(pauseClock(c, 60_000), 70_000);
    expect(clockSeconds(c, 90_000)).toBe(20);
  });
  it("formats times and compares rounds on total reps", () => {
    expect(formatRoundTime(65)).toBe("1:05");
    expect(compareRound({ seconds: 100, totalReps: 50 }, null)).toMatch(/number to beat/);
    expect(compareRound({ seconds: 95, totalReps: 52 }, { seconds: 100, totalReps: 50 })).toBe("2 more reps than last time.");
    expect(compareRound({ seconds: 130, totalReps: 48 }, { seconds: 100, totalReps: 50 })).toBe("2 fewer reps than last time.");
    expect(compareRound({ seconds: 90, totalReps: 50 }, { seconds: 100, totalReps: 50 })).toBe("Same total reps as last time.");
  });
});
