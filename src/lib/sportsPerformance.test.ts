import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPORTS_PROGRAMS, SPORTS_PERFORMANCE_GUIDE } from "./sportsPerformance";
import { SPORTS_GUIDES, watchOnlineUrl } from "./sportsGuides";
import { programFamily } from "./programs";
import { techniqueFor } from "./exerciseTechnique";

const migration = readFileSync(join(__dirname, "../../supabase/migrations/0093_sports_performance_programs.sql"), "utf8");

describe("Sports Performance programs", () => {
  it("has 3 programs of 6-8 weeks for each of the 5 areas", () => {
    for (const c of ["power", "speed", "strength", "mobility", "flexibility"]) {
      expect(SPORTS_PROGRAMS.filter((p) => p.category === c)).toHaveLength(3);
    }
  });
  it("describes the programs the migration adds, by their exact names", () => {
    for (const p of SPORTS_PROGRAMS) {
      expect(migration).toContain(`'${p.name}', place, ${p.weeks},`);
    }
  });
  it("puts each one under its own Sports Performance heading in the picker", () => {
    const family = { power: "sportsPower", speed: "sportsSpeed", strength: "sportsStrength", mobility: "sportsMobility", flexibility: "sportsFlexibility" };
    for (const p of SPORTS_PROGRAMS) expect(programFamily({ name: p.name, trainer_id: null })).toBe(family[p.category]);
  });
  it("describes every program in the trainer menu", () => {
    const text = JSON.stringify(SPORTS_PERFORMANCE_GUIDE);
    for (const p of SPORTS_PROGRAMS) expect(text).toContain(p.name);
  });
});

describe("Sports Performance guides", () => {
  it("has a guide for every new exercise the migration adds to the library", () => {
    const values = migration.slice(migration.indexOf("from (values"), migration.indexOf(") as v(name"));
    const names = [...values.matchAll(/\('((?:[^']|'')+)', '/g)].map((m) => m[1].replace(/''/g, "'"));
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) expect(SPORTS_GUIDES[name], name).toBeDefined();
    for (const name of Object.keys(SPORTS_GUIDES)) expect(names).toContain(name);
  });
  it("uses the sports guide before the general pattern guides, without the weight rule", () => {
    const guide = techniqueFor("Pigeon Stretch", "Flexibility");
    expect(guide?.pattern).toBe("Stretch");
    expect(guide?.noWeightRule).toBe(true);
    expect(techniqueFor("Bench Press", "Push")?.noWeightRule).toBeUndefined();
  });
  it("links to examples online", () => {
    expect(watchOnlineUrl("World's Greatest Stretch")).toBe(
      "https://www.youtube.com/results?search_query=how%20to%20do%20World's%20Greatest%20Stretch",
    );
  });
});
