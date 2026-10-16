import { describe, expect, it } from "vitest";
import { archiveChanges, bringBackChanges, compareIntake, compareLifts, compareStints, daysBetween, summarizeStint } from "./comeback";

const set = (exercise_name: string, weight_kg: number | null, warm_up = false) => ({ exercise_name, weight_kg, warm_up });

describe("comeback comparison", () => {
  const then = summarizeStint({
    days: 14,
    checkins: [
      { sleep_quality: 4, water_litres: 3, alcohol_units: 0 },
      { sleep_quality: 4, water_litres: 2, alcohol_units: 2 },
    ],
    sessions: [
      { status: "complete", star: true },
      { status: "complete", star: false },
      { status: "partial", star: false },
      { status: "missed", star: false },
    ],
    sets: [set("Squat", 100), set("Squat", 110), set("Bench", 80), set("Curl", 20), set("Squat", 200, true)],
  });
  const now = summarizeStint({
    days: 7,
    checkins: [{ sleep_quality: 3, water_litres: 2, alcohol_units: 2 }],
    sessions: [{ status: "complete", star: false }],
    sets: [set("Squat", 90), set("Squat", 95), set("Bench", 85), set("Row", 60)],
  });

  it("works out weekly rates and ignores warm-ups and missed days", () => {
    expect(then.workoutsPerWeek).toBe(1.5);
    expect(then.completePct).toBe(50);
    expect(then.bests.get("Squat")).toBe(110);
    expect(now.workoutsPerWeek).toBe(1);
  });

  it("marks what got better or worse", () => {
    const rows = compareStints(then, now);
    expect(rows.find((r) => r.label === "Workouts a week")).toEqual({ label: "Workouts a week", then: "1.5", now: "1", better: false });
    expect(rows.find((r) => r.label === "Alcohol units a day")?.better).toBe(false);
    expect(rows.find((r) => r.label === "Workouts fully done")?.better).toBe(true);
  });

  it("only compares lifts done both times, most-trained first", () => {
    expect(compareLifts(then, now)).toEqual([
      { label: "Squat", then: "110kg", now: "95kg", better: false },
      { label: "Bench", then: "80kg", now: "85kg", better: true },
    ]);
  });

  it("lists intake answers given both times", () => {
    expect(compareIntake({ weight_kg: "90", bedtime: "22:00" }, { weight_kg: "84" })).toEqual([
      { label: "Body weight (kg)", then: "90", now: "84", better: null },
    ]);
    expect(compareIntake({ weight_kg: "90" }, {})).toEqual([]);
  });

  it("counts at least one day", () => {
    expect(daysBetween("2026-10-01T00:00:00Z", "2026-10-15T00:00:00Z")).toBe(14);
    expect(daysBetween("2026-10-01T00:00:00Z", "2026-10-01T01:00:00Z")).toBe(1);
  });
});

describe("archive and bring back", () => {
  const base = {
    access_status: "active" as const,
    archived_at: null,
    first_stint_ended_at: null,
    returned_at: null,
    intake_responses: { weight_kg: "90" },
    first_intake_responses: null,
    training_level: "beginner" as const,
  };

  it("archives, closing access, and only the first archive ends the prime stint", () => {
    expect(archiveChanges(base, "T1")).toEqual({ archived_at: "T1", access_status: "expired", first_stint_ended_at: "T1" });
    expect(archiveChanges({ ...base, first_stint_ended_at: "T0" }, "T1").first_stint_ended_at).toBe("T0");
  });

  it("brings back with the first intake kept and the form asked again", () => {
    expect(bringBackChanges(base, "T2")).toEqual({
      archived_at: null,
      returned_at: "T2",
      first_intake_responses: { weight_kg: "90" },
      intake_responses: {},
      training_level: null,
    });
    const second = bringBackChanges({ ...base, first_intake_responses: { weight_kg: "100" } }, "T3");
    expect(second.first_intake_responses).toEqual({ weight_kg: "100" });
    expect(bringBackChanges({ ...base, intake_responses: {} }, "T4")).toEqual({ archived_at: null, returned_at: "T4" });
  });
});
