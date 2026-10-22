import { describe, expect, it } from "vitest";
import {
  bodySeries,
  cardioChoices,
  cardioSeries,
  compare,
  liftChoices,
  liftSeries,
  mainLiftOf,
  parseTime,
  sinceMonths,
  weighInDueIn,
  type LiftLog,
} from "@/lib/progress";

const log = (exercise_name: string, log_date: string, weight_kg: number | null, reps: number, warm_up = false): LiftLog => ({
  exercise_name,
  log_date,
  weight_kg,
  reps,
  warm_up,
});

describe("mainLiftOf", () => {
  it("knows the main lifts by their usual names", () => {
    expect(mainLiftOf("Barbell Back Squat")).toBe("squat");
    expect(mainLiftOf("Bulgarian split squat")).toBeNull();
    expect(mainLiftOf("Leg Press")).toBe("legpress");
    expect(mainLiftOf("Pull-ups")).toBe("pullup");
    expect(mainLiftOf("Chin up")).toBe("pullup");
    expect(mainLiftOf("Flat Barbell Bench Press")).toBe("bench");
    expect(mainLiftOf("Bench press")).toBe("bench");
    expect(mainLiftOf("Incline barbell bench")).toBeNull();
    expect(mainLiftOf("Dbell bench press")).toBe("dbbench");
    expect(mainLiftOf("Flat dumbbell bench")).toBe("dbbench");
    expect(mainLiftOf("Romanian deadlift")).toBeNull();
  });
});

describe("liftSeries", () => {
  it("takes the heaviest working set each day", () => {
    const logs = [
      log("Squat", "2026-10-01", 40, 10, true),
      log("Squat", "2026-10-01", 80, 8),
      log("Back squat", "2026-10-01", 80, 10),
      log("Squat", "2026-10-08", 90, 5),
    ];
    expect(liftSeries(logs, "squat")).toEqual({
      unit: "kg",
      points: [
        { date: "2026-10-01", value: 80, note: "80kg×10" },
        { date: "2026-10-08", value: 90, note: "90kg×5" },
      ],
    });
  });

  it("counts reps for body-weight exercises", () => {
    const logs = [log("Pull ups", "2026-10-01", null, 6), log("Pull ups", "2026-10-01", null, 8), log("Pull ups", "2026-10-03", 0, 9)];
    expect(liftSeries(logs, "pullup").points.map((p) => p.value)).toEqual([8, 9]);
    expect(liftSeries(logs, "pullup").unit).toBe("reps");
  });
});

describe("liftChoices", () => {
  it("lists main lifts first, then other exercises done on 2+ days", () => {
    const logs = [
      log("Leg press", "2026-10-01", 100, 10),
      log("Cable row", "2026-10-01", 40, 10),
      log("Cable row", "2026-10-02", 40, 10),
      log("Lunges", "2026-10-02", 10, 10),
    ];
    expect(liftChoices(logs).map((c) => c.label)).toEqual(["Leg press", "Cable row"]);
  });
});

describe("cardio", () => {
  const tests = [
    { id: "1", test_date: "2026-09-01", machine: "Assault bike", seconds: 600, distance_m: 3000, calories: 120 },
    { id: "2", test_date: "2026-10-01", machine: "Assault bike", seconds: 600, distance_m: 3400, calories: null },
    { id: "3", test_date: "2026-10-01", machine: "SkiErg", seconds: 300, distance_m: 1200, calories: 60 },
  ];
  it("groups the same machine and time as one test", () => {
    expect(cardioChoices(tests)).toEqual([
      { key: "assault bike|600", label: "Assault bike · 10 min", count: 2 },
      { key: "skierg|300", label: "SkiErg · 5 min", count: 1 },
    ]);
    expect(cardioSeries(tests, "assault bike|600", "distance").map((p) => p.value)).toEqual([3000, 3400]);
    expect(cardioSeries(tests, "assault bike|600", "calories").map((p) => p.value)).toEqual([120]);
  });
  it("reads times", () => {
    expect(parseTime("10")).toBe(600);
    expect(parseTime("2:30")).toBe(150);
    expect(parseTime("1:05:00")).toBe(3900);
    expect(parseTime("2:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });
});

describe("compare and body", () => {
  it("says whether it went the right way", () => {
    const pts = bodySeries(
      [
        { id: "a", measured_on: "2026-09-01", weight_kg: 90 },
        { id: "b", measured_on: "2026-09-15", weight_kg: 86 },
        { id: "c", measured_on: "2026-10-01", weight_kg: 87, waist_cm: 90 },
      ],
      "weight_kg",
    );
    expect(compare(pts, "down")).toMatchObject({ best: { value: 86 }, change: -3, pct: -3.3, trend: "better" });
    expect(compare(pts, "up")?.trend).toBe("worse");
    expect(compare(pts, null)?.trend).toBeNull();
  });
  it("trims to recent months", () => {
    const pts = [
      { date: "2026-01-01", value: 1 },
      { date: "2026-08-01", value: 2 },
    ];
    expect(sinceMonths(pts, 3, "2026-10-22")).toEqual([{ date: "2026-08-01", value: 2 }]);
    expect(sinceMonths(pts, null, "2026-10-22")).toHaveLength(2);
  });
  it("works out when the next weigh-in is due", () => {
    expect(weighInDueIn(null, "2026-10-01", "2026-10-22")).toBeNull();
    expect(weighInDueIn("week", null, "2026-10-22")).toBe(0);
    expect(weighInDueIn("week", "2026-10-20", "2026-10-22")).toBe(5);
    expect(weighInDueIn("2weeks", "2026-10-01", "2026-10-22")).toBe(-7);
  });
});
