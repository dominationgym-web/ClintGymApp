import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OFF_SEASON_PROGRAMS, SPORTS_PROGRAMS, SPORTS_PERFORMANCE_GUIDE, TWELVE_WEEK_PROGRAMS } from "./sportsPerformance";
import { SPORTS_GUIDES, SPORTS_SEARCH, watchOnlineUrl } from "./sportsGuides";
import { programFamily } from "./programs";
import { programGoal } from "./programGoals";
import { techniqueFor } from "./exerciseTechnique";

const migration = readFileSync(join(__dirname, "../../supabase/migrations/0093_sports_performance_programs.sql"), "utf8");
// Later additions to the same headings (Flexibility 4 – Lower Back Release, 0112).
const programMigrations = migration + readFileSync(join(__dirname, "../../supabase/migrations/0112_lower_back_stretch_program.sql"), "utf8");

describe("Sports Performance programs", () => {
  it("has at least 3 programs for each of the 5 areas", () => {
    for (const c of ["power", "speed", "strength", "mobility", "flexibility"]) {
      expect(SPORTS_PROGRAMS.filter((p) => p.category === c).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("describes the programs the migration adds, by their exact names", () => {
    for (const p of SPORTS_PROGRAMS) {
      expect(programMigrations).toContain(`'${p.name}', place, ${p.weeks},`);
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
      "https://www.youtube.com/results?search_query=worlds%20greatest%20stretch",
    );
    expect(watchOnlineUrl("90/90 Hip Switch")).toBe("https://www.youtube.com/results?search_query=90%2090%20hip%20switch");
    expect(watchOnlineUrl("Cat-Cow")).toBe("https://www.youtube.com/results?search_query=cat%20cow%20stretch");
    for (const name of Object.keys(SPORTS_SEARCH)) expect(SPORTS_GUIDES[name], name).toBeDefined();
  });
});

describe("Off-season programs", () => {
  const offSeason = readFileSync(join(__dirname, "../../supabase/migrations/0144_off_season_programs.sql"), "utf8");
  it("lists every off-season program the migration adds, under Off-season and the Sport goal", () => {
    expect(OFF_SEASON_PROGRAMS).toHaveLength(9);
    const text = JSON.stringify(SPORTS_PERFORMANCE_GUIDE);
    for (const p of OFF_SEASON_PROGRAMS) {
      expect(offSeason).toContain(`'${p.name}'`);
      expect(text).toContain(p.name);
      expect(programFamily({ name: p.name, trainer_id: null })).toBe("offSeason");
      expect(programGoal({ name: p.name, trainer_id: null })).toBe("sport");
    }
  });
  it("has no overhead pressing", () => {
    expect(offSeason).not.toMatch(/\["[^"]*(overhead|military|push press|arnold|shoulder press)/i);
  });
});

describe("12-week sport programs", () => {
  const twelve = readFileSync(join(__dirname, "../../supabase/migrations/0147_sport_blocks_12_week.sql"), "utf8");
  it("adds 27 programs, each in its own picker heading and under the Sport goal", () => {
    expect(TWELVE_WEEK_PROGRAMS).toHaveLength(27);
    const family = { Strength: "sportStrength12", Endurance: "sportEndurance12", Speed: "sportSpeed12" } as const;
    for (const name of TWELVE_WEEK_PROGRAMS) {
      expect(twelve).toContain(`add_sport_block('${name}'`);
      const focus = name.split(" ")[1] as keyof typeof family;
      expect(programFamily({ name, trainer_id: null })).toBe(family[focus]);
      expect(programGoal({ name, trainer_id: null })).toBe("sport");
    }
    expect(JSON.stringify(SPORTS_PERFORMANCE_GUIDE)).toContain("12-week sport programs");
  });
  it("has no overhead pressing", () => {
    expect(twelve).not.toMatch(/\["[^"]*(overhead|military|push press|arnold|shoulder press)/i);
  });
});
