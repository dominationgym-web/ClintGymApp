import { describe, expect, it } from "vitest";
import { buildTimerPhases, cleanSettings, countdownCue, defaultSettings, describeTimer, totalSeconds, defaultTimerName } from "./timerWorkouts";

describe("timer workouts", () => {
  it("EMOM: one phase a minute, exercises taking turns, after a get ready", () => {
    const s = { ...defaultSettings("emom"), rounds: 4, exercises: ["10 burpees", "15 swings"] };
    const phases = buildTimerPhases(s);
    expect(phases[0].getReady).toBe(true);
    const work = phases.slice(1);
    expect(work.map((p) => p.name)).toEqual(["10 burpees", "15 swings", "10 burpees", "15 swings"]);
    expect(work.every((p) => p.kind === "work" && p.seconds === 60)).toBe(true);
    expect(totalSeconds(s)).toBe(240);
  });

  it("EMOM with no exercises is just the clock", () => {
    const phases = buildTimerPhases({ ...defaultSettings("emom"), rounds: 2 });
    expect(phases.slice(1).map((p) => p.name)).toEqual(["Interval 1", "Interval 2"]);
  });

  it("Tabata: 8 x 20/10 is 4 minutes less the last rest", () => {
    const s = defaultSettings("tabata");
    const phases = buildTimerPhases(s).slice(1);
    expect(phases.filter((p) => p.kind === "work")).toHaveLength(8);
    expect(phases.filter((p) => p.kind === "easy")).toHaveLength(7);
    expect(phases[phases.length - 1].kind).toBe("work");
    expect(totalSeconds(s)).toBe(8 * 20 + 7 * 10);
  });

  it("Tabata: more than one, with the longer rest between", () => {
    const s = { ...defaultSettings("tabata"), sets: 2, setRest: 60, exercises: ["Squats", "Push-ups"] };
    const phases = buildTimerPhases(s).slice(1);
    const between = phases.filter((p) => p.seconds === 60);
    expect(between).toHaveLength(1);
    expect(between[0].detail).toBe("Before Tabata 2 of 2");
    const work = phases.filter((p) => p.kind === "work");
    expect(work.slice(0, 3).map((p) => p.name)).toEqual(["Squats", "Push-ups", "Squats"]);
    expect(work[8].set).toBe(2);
    expect(totalSeconds(s)).toBe(2 * (8 * 20 + 7 * 10) + 60);
  });

  it("Tabata: one exercise per Tabata", () => {
    const s = { ...defaultSettings("tabata"), sets: 2, switchEach: "set" as const, exercises: ["Squats", "Push-ups"] };
    const work = buildTimerPhases(s).filter((p) => p.kind === "work");
    expect(new Set(work.slice(0, 8).map((p) => p.name))).toEqual(new Set(["Squats"]));
    expect(new Set(work.slice(8).map((p) => p.name))).toEqual(new Set(["Push-ups"]));
  });

  it("Custom: each round goes through every exercise, round rest between rounds", () => {
    const s = { ...defaultSettings("custom"), work: 40, rest: 20, rounds: 2, setRest: 90, exercises: ["A", "B", "C"] };
    const phases = buildTimerPhases(s).slice(1);
    expect(phases.map((p) => `${p.kind}:${p.name}:${p.seconds}`)).toEqual([
      "work:A:40", "easy:Rest:20", "work:B:40", "easy:Rest:20", "work:C:40", "easy:Rest:90",
      "work:A:40", "easy:Rest:20", "work:B:40", "easy:Rest:20", "work:C:40",
    ]);
    expect(phases[5].detail).toBe("Before round 2 of 2");
  });

  it("Custom with no exercises: work and rest for each round", () => {
    const s = { ...defaultSettings("custom"), work: 30, rest: 30, rounds: 3 };
    const phases = buildTimerPhases(s).slice(1);
    expect(phases).toHaveLength(5);
    expect(totalSeconds(s)).toBe(150);
    expect(describeTimer(s)).toBe("Intervals · 30/30 x 3 rounds · 2:30");
  });

  it("no rest phase at 0 seconds", () => {
    const phases = buildTimerPhases({ ...defaultSettings("custom"), rest: 0, rounds: 3 });
    expect(phases.slice(1).every((p) => p.kind === "work")).toBe(true);
  });

  it("puts a saved timer right", () => {
    expect(cleanSettings({ kind: "tabata", work: 2, rounds: 999, exercises: [" Squats ", "", 5] })).toMatchObject({
      kind: "tabata",
      work: 5,
      rounds: 60,
      exercises: ["Squats"],
    });
    expect(cleanSettings(null).kind).toBe("custom");
    expect(cleanSettings({ kind: "emom", work: 10 }).work).toBe(30);
  });

  it("names a timer from its exercises", () => {
    expect(defaultTimerName({ ...defaultSettings("emom"), exercises: ["Burpees", "Swings", "Rows"] })).toBe("EMOM: Burpees, Swings...");
    expect(defaultTimerName(defaultSettings("tabata"))).toBe("Tabata 8 rounds");
  });
});

describe("boxing rounds", () => {
  it("rounds with a bell and rest between, none after the last", () => {
    const s = { ...defaultSettings("boxing"), work: 180, rest: 60, rounds: 3 };
    const phases = buildTimerPhases(s).slice(1);
    expect(phases.map((p) => `${p.kind}:${p.seconds}`)).toEqual(["work:180", "easy:60", "work:180", "easy:60", "work:180"]);
    expect(phases.every((p) => p.bell)).toBe(true);
    expect(phases[0].name).toBe("Round 1");
    expect(totalSeconds(s)).toBe(3 * 180 + 2 * 60);
    expect(describeTimer(s)).toBe("Boxing · 3 x 3 min · 60 sec rest · 11:00");
  });

  it("keeps a saved boxing timer to 2-6 minute rounds, 30-90 sec rest and 12 rounds", () => {
    expect(cleanSettings({ kind: "boxing", work: 1000, rest: 5, rounds: 20 })).toMatchObject({ work: 360, rest: 30, rounds: 12 });
    expect(cleanSettings({ kind: "boxing", work: 150, rest: 200 })).toMatchObject({ work: 180, rest: 90 });
  });
});

describe("countdown sounds", () => {
  it("knocks at 30 seconds, ticks the last 10 and beeps the last 3", () => {
    expect(countdownCue(30, 60)).toBe("knock");
    expect(countdownCue(31, 60)).toBeNull();
    expect(countdownCue(11, 60)).toBeNull();
    expect([10, 9, 4].map((s) => countdownCue(s, 60))).toEqual(["ticker", "ticker", "ticker"]);
    expect([3, 2, 1].map((s) => countdownCue(s, 60))).toEqual(["tick", "tick", "tick"]);
    expect(countdownCue(0, 60)).toBeNull();
  });

  it("no knocks on short phases, nothing on the first second", () => {
    expect(countdownCue(30, 35)).toBeNull();
    expect(countdownCue(10, 10)).toBeNull();
    expect(countdownCue(9, 10)).toBe("ticker");
  });

  it("boxing rounds keep the clapper at 10 seconds", () => {
    expect(countdownCue(10, 180, true)).toBe("clapper");
    expect(countdownCue(30, 180, true)).toBe("knock");
    expect(countdownCue(9, 180, true)).toBe("ticker");
  });
});
