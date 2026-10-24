import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BLOCK_WEEK_GUIDE,
  MUSCLE_YEAR_BLOCKS,
  RECOVERY_BASICS,
  blockOfWeek,
  muscleLevel,
  proteinPerMeal,
  weeklyGainKg,
  weightCheck,
} from "@/lib/muscleYear";

describe("Muscle Year weight check", () => {
  it("asks for a weigh-in when there is none", () => {
    expect(weightCheck([], "beginner").kind).toBe("need");
  });

  it("waits until two weigh-ins are 10+ days apart", () => {
    const check = weightCheck(
      [
        { measured_on: "2026-10-01", weight_kg: 80 },
        { measured_on: "2026-10-06", weight_kg: 80.3 },
      ],
      "beginner",
    );
    expect(check).toMatchObject({ kind: "wait", days: 9 });
  });

  it("says eat more when weight isn't going up", () => {
    const check = weightCheck(
      [
        { measured_on: "2026-10-01", weight_kg: 80 },
        { measured_on: "2026-10-15", weight_kg: 80 },
      ],
      "beginner",
    );
    expect(check.kind).toBe("slow");
    expect(check.message).toContain("150 kcal a day more");
  });

  it("says eat less when gaining too fast", () => {
    const check = weightCheck(
      [
        { measured_on: "2026-10-01", weight_kg: 80 },
        { measured_on: "2026-10-15", weight_kg: 82 },
      ],
      "intermediate",
    );
    expect(check).toMatchObject({ kind: "fast", perWeekKg: 1 });
  });

  it("is on track at about 0.3 kg a week for an 80 kg beginner", () => {
    const check = weightCheck(
      [
        { measured_on: "2026-09-01", weight_kg: 79 },
        { measured_on: "2026-10-01", weight_kg: 80 },
        { measured_on: "2026-10-15", weight_kg: 80.6 },
        { measured_on: "2026-10-16", weight_kg: null },
      ],
      "beginner",
    );
    expect(check).toMatchObject({ kind: "onTrack", perWeekKg: 0.3, days: 14 });
  });

  it("works out the weekly target from weight and level", () => {
    expect(weeklyGainKg(80, "beginner")).toEqual({ low: 0.2, high: 0.4 });
    expect(muscleLevel("never")).toBe("beginner");
    expect(muscleLevel(null)).toBe("intermediate");
    expect(proteinPerMeal(160, 4)).toBe(40);
  });
});

describe("Muscle Year blocks", () => {
  it("has four 13-week blocks", () => {
    expect(MUSCLE_YEAR_BLOCKS.map((b) => b.weeks)).toEqual(["Weeks 1-13", "Weeks 14-26", "Weeks 27-39", "Weeks 40-52"]);
    expect(blockOfWeek(1)).toBe(1);
    expect(blockOfWeek(13)).toBe(1);
    expect(blockOfWeek(14)).toBe(2);
    expect(blockOfWeek(52)).toBe(4);
    expect(blockOfWeek(53)).toBeNull();
  });

  it("never suggests oats", () => {
    const text = JSON.stringify([MUSCLE_YEAR_BLOCKS, BLOCK_WEEK_GUIDE, RECOVERY_BASICS]).toLowerCase();
    expect(text).not.toContain("oat");
  });
});

describe("Muscle Year programs (0150)", () => {
  const sql = readFileSync("supabase/migrations/0150_muscle_year_programs.sql", "utf8");
  const calls = [...sql.matchAll(/select public\.add_muscle_year\('([^']+)',[\s\S]*?'(\{"b1"[^\n]*\})'::jsonb\);/g)];

  it("adds the 3, 4 and 5 day programs", () => {
    expect(calls.map((c) => c[1])).toEqual(["Muscle Year – 3 days a week", "Muscle Year – 4 days a week", "Muscle Year – 5 days a week"]);
  });

  it("has every block's sessions, no overhead pressing and no hack squats", () => {
    const days = [3, 4, 5];
    calls.forEach((c, i) => {
      const tpl = JSON.parse(c[2].replace(/''/g, "'")) as Record<string, Record<string, [string, number, string, number, boolean][]>>;
      expect(Object.keys(tpl)).toEqual(["b1", "b2", "b3", "b4"]);
      for (const block of Object.values(tpl)) {
        expect(Object.keys(block)).toHaveLength(days[i]);
        for (const rows of Object.values(block)) {
          expect(rows.length).toBeGreaterThanOrEqual(6);
          expect(rows.length).toBeLessThanOrEqual(7);
          for (const [name, sets] of rows) {
            expect(name).not.toMatch(/overhead press|military|push press|jerk|thruster|arnold|hack squat/i);
            expect(sets).toBeLessThanOrEqual(4);
          }
        }
      }
    });
    expect(sql.toLowerCase()).not.toContain("oat");
  });
});
