import { describe, expect, it } from "vitest";
import { cleanDate, cleanResult, importCounts, nameKey } from "../../supabase/functions/import-history/shape";

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
    expect(cleanResult(null, TODAY)).toEqual({ app_name: null, workouts: [], body: [], note: null });
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
    expect(importCounts(r)).toEqual({ days: 2, workouts: 3, sets: 4, body: 1, from: "2026-08-30", to: "2026-09-03" });
  });

  it("matches names whatever the spacing or case", () => {
    expect(nameKey("Barbell Bench-Press")).toBe(nameKey("barbell bench press"));
  });
});
