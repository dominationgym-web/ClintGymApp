import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assessExercise,
  findExercise,
  itemsFor,
  levelInfo,
  phaseFor,
  setsFor,
  STABILITY_AREAS,
  stabilityStartMessage,
  stabilityVideoNames,
  stabilityWeek,
  targetText,
  type StabilityLogLite,
} from "@/lib/stability";
import { youtubeSearchUrl } from "@/lib/watchOnline";

describe("stability programs", () => {
  it("has all 7 areas from the ground up, each with all 4 levels", () => {
    expect(STABILITY_AREAS.map((a) => a.area)).toEqual(["ankle", "knee", "hip", "core", "shoulder", "wrist", "neck"]);
    for (const a of STABILITY_AREAS) {
      expect(a.programs.map((p) => p.level)).toEqual(["rehab", "beginner", "intermediate", "advanced"]);
    }
  });

  it("every program is 4-8 weeks and its phases cover every week exactly once", () => {
    for (const a of STABILITY_AREAS) {
      for (const p of a.programs) {
        expect(p.weeks).toBe(levelInfo(p.level).weeks);
        expect(p.weeks).toBeGreaterThanOrEqual(4);
        expect(p.weeks).toBeLessThanOrEqual(8);
        const covered: number[] = [];
        for (const ph of p.phases) for (let w = ph.from; w <= ph.to; w++) covered.push(w);
        expect(covered, `${a.area} ${p.level}`).toEqual(Array.from({ length: p.weeks }, (_, i) => i + 1));
      }
    }
  });

  it("every exercise in a program exists, and every phase has a primer", () => {
    for (const a of STABILITY_AREAS) {
      const keys = a.exercises.map((e) => e.key);
      expect(new Set(keys).size, `${a.area} duplicate keys`).toBe(keys.length);
      for (const p of a.programs) {
        for (const ph of p.phases) {
          expect(itemsFor(ph, "primer").length, `${a.area} ${p.level} ${ph.title}`).toBeGreaterThan(0);
          for (const item of ph.items) expect(findExercise(a.area, item.ex), `${a.area}: ${item.ex}`).toBeDefined();
        }
      }
    }
  });

  it("every exercise explains how to do it, when control is lost, the load and how to progress", () => {
    for (const a of STABILITY_AREAS) {
      for (const e of a.exercises) {
        expect(e.steps.length, e.key).toBeGreaterThan(0);
        for (const field of [e.lossOfControl, e.resistance, e.easier, e.harder]) expect(field.length, e.key).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("never uses overhead pressing", () => {
    const text = JSON.stringify(STABILITY_AREAS.map((a) => a.exercises)).toLowerCase();
    expect(text).not.toMatch(/overhead press|shoulder press|military press/);
  });

  it("every exercise with no clip has a short search for examples online", () => {
    for (const a of STABILITY_AREAS) {
      for (const e of a.exercises) {
        if (e.video) continue;
        expect(e.search, e.key).toBeDefined();
        expect(e.search!.split(" ").length, e.key).toBeLessThanOrEqual(6);
        expect(youtubeSearchUrl(e.search!), e.key).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=[a-z0-9]+(\+[a-z0-9]+)*$/);
      }
    }
  });

  it("the video lookup in the migration lists exactly the clips the programs use", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/0094_stability_programs.sql", import.meta.url), "utf8");
    const list = sql.slice(sql.indexOf("and e.name in ("), sql.indexOf(")", sql.indexOf("and e.name in (") + 16));
    const names = [...list.matchAll(/'((?:[^']|'')+)'/g)].map((m) => m[1].replace(/''/g, "'")).sort();
    expect(names).toEqual(stabilityVideoNames());
  });
});

describe("stabilityWeek and phaseFor", () => {
  it("counts weeks from the start day", () => {
    expect(stabilityWeek("2026-10-14", "2026-10-14")).toBe(1);
    expect(stabilityWeek("2026-10-14", "2026-10-20")).toBe(1);
    expect(stabilityWeek("2026-10-14", "2026-10-21")).toBe(2);
    expect(stabilityWeek("2026-10-14", "2026-12-09")).toBe(9);
  });

  it("stays on the last phase after the program ends", () => {
    const knee = STABILITY_AREAS[1].programs[0];
    expect(phaseFor(knee, 1).from).toBe(1);
    expect(phaseFor(knee, 4).from).toBe(3);
    expect(phaseFor(knee, 12).from).toBe(7);
  });
});

describe("targets", () => {
  const balance = findExercise("ankle", "sl_balance")!;
  const dose = { ex: "sl_balance", sets: 3, target: 30, primer: true };

  it("reads naturally", () => {
    expect(targetText(dose, balance, "full")).toBe("3 x 30 sec each side");
    expect(targetText({ ...dose, note: "eyes closed" }, balance, "primer")).toBe("2 x 30 sec each side (eyes closed)");
    expect(targetText({ ex: "x", sets: 3, target: 12 }, findExercise("knee", "step_up")!, "full")).toBe("3 x 12 each side");
  });

  it("the primer is at most 2 sets", () => {
    expect(setsFor({ ...dose, sets: 10 }, "primer")).toBe(2);
    expect(setsFor({ ...dose, sets: 1 }, "primer")).toBe(1);
  });
});

describe("assessExercise", () => {
  const sided = { sided: true };
  const dose = { ex: "sl_balance", sets: 2, target: 30 };
  const set = (log_date: string, side: "left" | "right" | null, seconds: number): StabilityLogLite => ({
    log_date,
    side,
    seconds,
    reps: null,
    mode: "full",
  });

  it("is empty with no logs", () => {
    expect(assessExercise([], dose, sided)).toEqual({ best: null, last: null, lastDate: null, status: null });
  });

  it("is ready after hitting the target on both sides two sessions running", () => {
    const logs = [
      ...["2026-10-14", "2026-10-16"].flatMap((dt) => [set(dt, "left", 30), set(dt, "left", 32), set(dt, "right", 31), set(dt, "right", 30)]),
    ];
    const a = assessExercise(logs, dose, sided);
    expect(a.status).toBe("ready");
    expect(a.last).toBe("L 30, 32 · R 31, 30");
    expect(a.best).toBe(31);
  });

  it("isn't ready when one side falls short, and the weaker side sets the best", () => {
    const logs = ["2026-10-14", "2026-10-16"].flatMap((dt) => [set(dt, "left", 40), set(dt, "left", 40), set(dt, "right", 20), set(dt, "right", 25)]);
    const a = assessExercise(logs, dose, sided);
    expect(a.status).toBe(null);
    expect(a.best).toBe(25);
  });

  it("isn't ready when only one side was logged", () => {
    const logs = ["2026-10-14", "2026-10-16"].flatMap((dt) => [set(dt, "left", 40), set(dt, "left", 40)]);
    expect(assessExercise(logs, dose, sided).status).toBe(null);
  });

  it("suggests easier when the last session was under half the target", () => {
    const logs = [set("2026-10-16", "left", 12), set("2026-10-16", "right", 10)];
    expect(assessExercise(logs, dose, sided).status).toBe("easier");
  });

  it("counts reps and the primer's smaller set count", () => {
    const reps = (log_date: string, n: number): StabilityLogLite => ({ log_date, side: null, seconds: null, reps: n, mode: "primer" });
    const logs = [reps("2026-10-14", 12), reps("2026-10-14", 12), reps("2026-10-15", 13), reps("2026-10-15", 12)];
    expect(assessExercise(logs, { ex: "x", sets: 3, target: 12 }, { sided: false }).status).toBe("ready");
  });
});

describe("stabilityStartMessage", () => {
  it("names the program and where to find it", () => {
    const msg = stabilityStartMessage("Thandi Mokoena", "knee", "rehab");
    expect(msg).toMatch(/^Thandi, I've started you on the Knee stability program \(Rehab, 8 weeks\)/);
    expect(msg).toContain("My stability program");
  });
});
