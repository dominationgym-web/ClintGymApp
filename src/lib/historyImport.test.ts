import { describe, expect, it, vi } from "vitest";
import { cleanDate, cleanResult, importCounts, nameKey, undatedSessions } from "../../supabase/functions/import-history/shape";
import { groupUndated, importSummary, unitsLine, type UndatedSet } from "./historyImport";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const TODAY = "2026-10-22";

describe("cleanDate", () => {
  it("keeps real past dates only", () => {
    expect(cleanDate("2026-10-01", TODAY)).toBe("2026-10-01");
    expect(cleanDate("2026-10-23", TODAY)).toBeNull();
    expect(cleanDate("2026-02-30", TODAY)).toBeNull();
    expect(cleanDate("1999-12-31", TODAY)).toBeNull();
    expect(cleanDate("14 Oct", TODAY)).toBeNull();
  });
});

describe("cleanResult", () => {
  it("drops misreads and keeps the rest in date order", () => {
    const r = cleanResult(
      {
        app_name: " Strong ",
        workouts: [
          { date: "2026-10-05", exercise: "  Bench   Press ", sets: [{ weight_kg: "60,5", reps: 8 }, { weight_kg: null, reps: 0 }, { reps: 6.4 }] },
          { date: "2026-10-01", exercise: "Squat", sets: [{ weight_kg: 100, reps: 5 }] },
          { date: "2026-12-01", exercise: "Future", sets: [{ reps: 5 }] },
          { date: "2026-10-02", exercise: "", sets: [{ reps: 5 }] },
          { date: "2026-10-03", exercise: "Plank", sets: [{ reps: 0 }] },
        ],
        body: [
          { date: "2026-10-04", weight_kg: 82.34, waist_cm: 5 },
          { date: "2026-10-06", waist_cm: 3 },
        ],
        note: "",
      },
      TODAY,
    );
    expect(r.app_name).toBe("Strong");
    expect(r.note).toBeNull();
    expect(r.workouts).toEqual([
      { date: "2026-10-01", exercise: "Squat", sets: [{ weight_kg: 100, reps: 5 }] },
      { date: "2026-10-05", exercise: "Bench Press", sets: [{ weight_kg: 60.5, reps: 8 }, { weight_kg: null, reps: 6 }] },
    ]);
    expect(r.body).toEqual([{ date: "2026-10-04", weight_kg: 82.3 }]);
  });

  it("copes with nonsense", () => {
    expect(cleanResult(null, TODAY)).toEqual({ app_name: null, workouts: [], body: [], note: null, units: "metric", units_assumed: false });
  });
});

describe("importCounts and nameKey", () => {
  it("counts days, sets and the date range", () => {
    const r = cleanResult(
      {
        workouts: [
          { date: "2026-09-01", exercise: "Squat", sets: [{ reps: 5 }, { reps: 5 }] },
          { date: "2026-09-01", exercise: "Row", sets: [{ reps: 8 }] },
          { date: "2026-09-03", exercise: "Squat", sets: [{ reps: 5 }] },
        ],
        body: [{ date: "2026-08-30", weight_kg: 80 }],
      },
      TODAY,
    );
    expect(importCounts(r)).toEqual({ days: 2, workouts: 3, sets: 4, body: 1, from: "2026-08-30", to: "2026-09-03", undated: 0, undated_workouts: 0 });
  });

  it("matches names whatever the spacing or case", () => {
    expect(nameKey("Barbell Bench-Press")).toBe(nameKey("barbell bench press"));
  });
});

// GRIZZ 2026-11-03: a trainer's spreadsheet screenshots ("WEEK - 1") had no
// dates and no kg/lb, and nothing was saved.
describe("no dates and no units (0189)", () => {
  const sheet = {
    workouts: [
      { date: null, session: "WEEK - 1", exercise: "Barbell Bent Over Row", unit: null, sets: [{ weight: 10, reps: 12 }, { weight: 10, reps: 11 }, { weight: 10, reps: 11 }] },
      { date: null, session: "WEEK - 1", exercise: "Barbell Bench Press Flat", unit: null, sets: [{ weight: 22.5, reps: 20 }, { weight: 10, reps: 16 }, { weight: null, reps: null }] },
      { date: null, session: "WEEK - 1", exercise: "Dbell Incline Bench Press", sets: [{ weight: null, reps: null }, {}] },
      { date: null, session: "WEEK - 1", exercise: "Push ups", sets: [] },
      { date: "", session: "WEEK - 1", exercise: "Barbell Bent Over Row", sets: [{ weight: 10, reps: 18 }] },
    ],
    body: [{ date: null, weight: 80 }],
  };

  it("keeps undated workouts in order, skips empty sets and exercises, keeps half values", () => {
    const r = cleanResult(sheet, TODAY);
    expect(r.workouts).toEqual([
      { date: null, session: "WEEK - 1", exercise: "Barbell Bent Over Row", sets: [{ weight_kg: 10, reps: 12 }, { weight_kg: 10, reps: 11 }, { weight_kg: 10, reps: 11 }] },
      { date: null, session: "WEEK - 1", exercise: "Barbell Bench Press Flat", sets: [{ weight_kg: 22.5, reps: 20 }, { weight_kg: 10, reps: 16 }] },
      { date: null, session: "WEEK - 1", exercise: "Barbell Bent Over Row", sets: [{ weight_kg: 10, reps: 18 }] },
    ]);
    expect(r.body).toEqual([]);
    expect(r.units_assumed).toBe(true);
    // The row exercise comes up again, so that's a second session.
    expect(undatedSessions(r).map((s) => s.workouts.length)).toEqual([2, 1]);
    const c = importCounts(r);
    expect(c).toMatchObject({ days: 0, workouts: 0, undated: 2, undated_workouts: 3, from: null, to: null });
    expect(importSummary(r)).toBe("2 sessions with no date (3 exercises)");
    expect(unitsLine(r)).toMatch(/read as kg/);
  });

  it("reads unlabelled numbers in pounds for an imperial trainer", () => {
    const r = cleanResult(
      {
        workouts: [
          { date: "2026-10-01", exercise: "Squat", unit: null, sets: [{ weight: 100, reps: 5 }] },
          { date: "2026-10-01", exercise: "Row", unit: "kg", sets: [{ weight: 40, reps: 8 }] },
        ],
        body: [{ date: "2026-10-01", weight: 180, waist: 34 }],
      },
      TODAY,
      "imperial",
    );
    expect(r.workouts.map((w) => w.sets[0].weight_kg)).toEqual([45.36, 40]);
    expect(r.body).toEqual([{ date: "2026-10-01", weight_kg: 81.6, waist_cm: 86.4 }]);
    expect(unitsLine(r)).toMatch(/pounds/);
  });

  it("uses the unit the file shows over the trainer's setting", () => {
    const r = cleanResult({ weight_unit: "lb", workouts: [{ date: null, exercise: "Curl", sets: [{ weight: 20, reps: 10 }] }], body: [] }, TODAY, "metric");
    expect(r.workouts[0].sets[0].weight_kg).toBe(9.07);
    expect(r.units_assumed).toBe(false);
  });

  it("groups saved undated sets into labelled sessions", () => {
    const row = (o: Partial<UndatedSet>): UndatedSet => ({
      import_id: "a", session_label: null, session_order: 0, exercise_id: null, exercise_name: "Row", set_number: 1, weight_kg: 10, reps: 12, created_at: "2026-11-03T10:00:00Z", ...o,
    });
    const s = groupUndated([
      row({ session_order: 1, exercise_name: "Bench" }),
      row({ set_number: 2, reps: 11 }),
      row({}),
      row({ import_id: "b", session_label: "WEEK - 2", created_at: "2026-11-03T11:00:00Z" }),
    ]);
    expect(s.map((x) => x.label)).toEqual(["Session 1", "Session 2", "WEEK - 2"]);
    expect(s[0].exercises[0].sets.map((x) => x.reps)).toEqual([12, 11]);
  });
});
