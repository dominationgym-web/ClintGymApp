import { describe, expect, it } from "vitest";
import {
  clockSeconds,
  compareRound,
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
  it("uses fewer drops on plate-loaded lifts", () => {
    expect(dropRange("Leg Press")).toEqual({ min: 6, max: 8 });
    expect(dropRange("Smith Machine Squat")).toEqual({ min: 6, max: 8 });
    expect(dropRange("Cable Curl")).toEqual({ min: 8, max: 10 });
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
  it("formats and compares round times", () => {
    expect(formatRoundTime(65)).toBe("1:05");
    expect(compareRound({ seconds: 100, totalReps: 50 }, null)).toMatch(/time to beat/);
    expect(compareRound({ seconds: 95, totalReps: 52 }, { seconds: 100, totalReps: 50 })).toBe("0:05 faster than last time, 2 more reps.");
    expect(compareRound({ seconds: 130, totalReps: 48 }, { seconds: 100, totalReps: 50 })).toBe("0:30 slower than last time, 2 fewer reps.");
    expect(compareRound({ seconds: 100, totalReps: 50 }, { seconds: 100, totalReps: 50 })).toBe("Same time as last time, same reps.");
  });
});
