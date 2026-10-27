import { describe, expect, it } from "vitest";
import {
  bestSet,
  exercisesByDay,
  exercisesLabel,
  grouped,
  lastSession,
  liftedKg,
  monthStarts,
  newBests,
  oneRepMax,
  pctChange,
  perWeek,
  records,
  type DashLog,
} from "@/lib/clientDashboard";

const set = (exercise_name: string, log_date: string, weight_kg: number | null, reps: number, set_number = 1, warm_up = false): DashLog => ({
  exercise_name,
  log_date,
  weight_kg,
  reps,
  set_number,
  warm_up,
});

const logs: DashLog[] = [
  set("Barbell bench press", "2026-10-19", 50, 10, 0, true),
  set("Barbell bench press", "2026-10-19", 80, 6, 1),
  set("Barbell bench press", "2026-10-19", 80, 5, 2),
  set("Back squat", "2026-10-21", 100, 5, 1),
  set("Pull-ups", "2026-10-21", null, 8, 1),
  set("Barbell bench press", "2026-10-26", 85, 6, 2),
  set("Barbell bench press", "2026-10-26", 82.5, 8, 1),
  set("Back squat", "2026-10-26", 95, 5, 1),
];

describe("client dashboard sums", () => {
  it("adds weight × reps of working sets only", () => {
    expect(liftedKg(logs, "2026-10-19", "2026-10-25")).toBe(80 * 6 + 80 * 5 + 100 * 5);
    expect(liftedKg(logs, "2026-10-26", "2026-11-01", "bench")).toBe(85 * 6 + 82.5 * 8);
  });

  it("lists each day's exercises", () => {
    const byDay = exercisesByDay(logs, ["2026-10-21", "2026-10-22"]);
    expect(byDay.get("2026-10-21")).toEqual(["Back squat", "Pull-ups"]);
    expect(byDay.get("2026-10-22")).toEqual([]);
    expect(exercisesLabel(["A", "B", "C", "D"])).toBe("A, B +2 more");
  });

  it("finds best sets and new bests", () => {
    expect(bestSet(logs, "bench")).toMatchObject({ kg: 85, reps: 6, date: "2026-10-26" });
    expect(bestSet(logs, "bench", "2026-10-26")).toMatchObject({ kg: 80, reps: 6 });
    const bests = newBests(logs, "2026-10-26");
    expect(bests).toHaveLength(1);
    expect(bests[0]).toMatchObject({ name: "Flat barbell bench", kg: 85, was: { kg: 80 } });
    expect(oneRepMax(100, 5)).toBe(117);
    expect(oneRepMax(100, 1)).toBe(100);
  });

  it("shows the last session in set order, warm-ups first", () => {
    const last = lastSession(logs, "bench")!;
    expect(last.date).toBe("2026-10-26");
    expect(last.sets.map((s) => s.weight_kg)).toEqual([82.5, 85]);
  });

  it("lists records heaviest first, leaving out body-weight-only exercises", () => {
    const r = records(logs);
    expect(r.map((x) => x.name)).toEqual(["Squats", "Flat barbell bench"]);
    expect(r[1].oneRm).toBe(102);
  });

  it("works out months, changes and pace", () => {
    expect(monthStarts("2026-10-27")).toEqual({ thisMonth: "2026-10-01", lastMonth: "2026-09-01", lastMonthEnd: "2026-09-30" });
    expect(monthStarts("2026-01-05")).toEqual({ thisMonth: "2026-01-01", lastMonth: "2025-12-01", lastMonthEnd: "2025-12-31" });
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(5, 0)).toBeNull();
    expect(grouped(18450)).toBe("18 450");
    expect(perWeek([{ date: "2026-09-01", value: 88 }, { date: "2026-09-29", value: 86 }])).toBe(-0.5);
    expect(perWeek([{ date: "2026-09-01", value: 88 }, { date: "2026-09-08", value: 86 }])).toBeNull();
  });
});
