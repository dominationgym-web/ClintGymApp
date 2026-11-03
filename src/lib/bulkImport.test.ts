import { describe, expect, it } from "vitest";
import {
  applyColumnMap,
  cleanColumnMap,
  matchClient,
  mergePeople,
  numberCell,
  parseCsv,
  parseDateCell,
  sniffDelimiter,
} from "../../supabase/functions/import-history/bulk";
import { cleanResult } from "../../supabase/functions/import-history/shape";

// One file with all of a trainer's clients (0190, GRIZZ 2026-11-03).
describe("parseCsv", () => {
  it("handles quotes, semicolons and blank lines", () => {
    expect(sniffDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(parseCsv('Name,Note\n"Smith, Jade","said ""hi"""\n\n,\nBob,x\r\n')).toEqual([
      ["Name", "Note"],
      ["Smith, Jade", 'said "hi"'],
      ["Bob", "x"],
    ]);
  });
});

describe("cells", () => {
  it("reads dates in any common form", () => {
    expect(parseDateCell("2026-03-05 10:22:00", null)).toBe("2026-03-05");
    expect(parseDateCell("05/03/2026", "dmy")).toBe("2026-03-05");
    expect(parseDateCell("05/03/2026", "mdy")).toBe("2026-05-03");
    expect(parseDateCell("25/03/2026", "mdy")).toBeNull();
    expect(parseDateCell("3/25/26", null)).toBe("2026-03-25");
    expect(parseDateCell("5 Mar 2026", null)).toBe("2026-03-05");
    expect(parseDateCell("March 5, 2026", null)).toBe("2026-03-05");
    expect(parseDateCell("46086", null)).toBe("2026-03-05");
    expect(parseDateCell("", null)).toBeNull();
  });

  it("reads numbers with commas and units", () => {
    expect(numberCell("22,5 kg")).toEqual({ n: 22.5, unit: "kg" });
    expect(numberCell("135 lbs")).toEqual({ n: 135, unit: "lb" });
    expect(numberCell("")).toEqual({ n: null, unit: null });
  });
});

describe("cleanColumnMap", () => {
  it("needs names and sets or body weight", () => {
    expect(cleanColumnMap({ tabular: false })).toBeNull();
    expect(cleanColumnMap({ tabular: true, name: [], exercise: 2, reps: [3] })).toBeNull();
    expect(cleanColumnMap({ tabular: true, name: [0], exercise: 2, reps: [] })).toBeNull();
    expect(cleanColumnMap({ tabular: true, name: [0, "x", -1], exercise: 2, reps: [3], unit: "stone" })).toMatchObject({
      name: [0],
      unit: null,
      header_rows: 1,
    });
  });
});

describe("applyColumnMap", () => {
  it("splits a one-row-per-set export by person", () => {
    const rows = parseCsv(
      [
        "Client,Date,Workout,Exercise,Set,Weight,Reps,Body weight",
        "Jade Smith,05/03/2026,Push,Bench Press,2,40,8,62",
        "Jade Smith,05/03/2026,Push,Bench Press,1,40,10,",
        "Thabo M,05/03/2026,Legs,Squat,1,135 lbs,5,",
        "Jade Smith,,Week 1,Row,1,20,12,",
        "Thabo M,06/03/2026,Legs,Squat,1,,,",
      ].join("\n"),
    );
    const map = cleanColumnMap({
      tabular: true,
      header_rows: 1,
      name: [0],
      date: 1,
      date_format: "dmy",
      session: 2,
      exercise: 3,
      set_number: 4,
      weights: [5],
      reps: [6],
      body_weight: 7,
    })!;
    const people = applyColumnMap(rows, map);
    expect(people.map((p) => p.name)).toEqual(["Jade Smith", "Thabo M"]);
    const jade = cleanResult(people[0], "2026-11-03");
    expect(jade.workouts).toEqual([
      { date: null, session: "Week 1", exercise: "Row", sets: [{ weight_kg: 20, reps: 12 }] },
      { date: "2026-03-05", exercise: "Bench Press", sets: [{ weight_kg: 40, reps: 10 }, { weight_kg: 40, reps: 8 }] },
    ]);
    expect(jade.body).toEqual([{ date: "2026-03-05", weight_kg: 62 }]);
    const thabo = cleanResult(people[1], "2026-11-03");
    expect(thabo.workouts).toEqual([{ date: "2026-03-05", exercise: "Squat", sets: [{ weight_kg: 61.23, reps: 5 }] }]);
  });

  it("reads sets across the row, with first name and surname apart", () => {
    const rows = parseCsv(["First,Last,Date,Exercise,W1,R1,W2,R2", "Jade,Smith,2026-03-05,Curl,10,12,10,", "Jade,Smith,2026-03-05,Plank,,,,"].join("\n"));
    const map = cleanColumnMap({ tabular: true, name: [0, 1], date: 2, exercise: 3, weights: [4, 6], reps: [5, 7] })!;
    const [jade] = applyColumnMap(rows, map, "imperial");
    expect(jade.name).toBe("Jade Smith");
    // The empty second set and the empty Plank are left out; no unit shown, so pounds.
    expect(cleanResult(jade, "2026-11-03", "imperial").workouts).toEqual([
      { date: "2026-03-05", exercise: "Curl", sets: [{ weight_kg: 4.54, reps: 12 }] },
    ]);
  });
});

describe("people and clients", () => {
  it("merges people across files by name", () => {
    const a = { name: "Jade Smith", workouts: [], body: [{ date: "2026-01-01", weight: 60 }] };
    const b = { name: "jade  smith", workouts: [], body: [{ date: "2026-02-01", weight: 61 }] };
    expect(mergePeople([[a], [b]])).toHaveLength(1);
    expect(mergePeople([[a], [b]])[0].body).toHaveLength(2);
  });

  it("matches names to clients only when one fits", () => {
    const clients = [
      { id: "1", name: "Jade Smith" },
      { id: "2", name: "Thabo Mokoena" },
      { id: "3", name: "Jade Naidoo" },
    ];
    expect(matchClient("jade smith", clients)).toBe("1");
    expect(matchClient("Thabo", clients)).toBe("2");
    expect(matchClient("Jade", clients)).toBeNull();
    expect(matchClient("Sipho", clients)).toBeNull();
    expect(matchClient("Thabo Mokoena Jr", clients)).toBe("2");
  });
});
