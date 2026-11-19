import { describe, expect, it } from "vitest";
import { EVOLUTION_STAGES, EVOLUTION_STEPS, EVO_GUIDE_VERSION, ONE_ON_ONE_STEPS, activeGuide, readGuideState, requestGuideOpen, shouldAutoStart, takeGuideOpen } from "./setupGuide";

const trainer = { is_owner: false, evolution_started_on: null as string | null };

describe("setup guide", () => {
  it("1 on 1 goes times, screenshot, upload, then clients, linking, nutrition", () => {
    expect(ONE_ON_ONE_STEPS.map((s) => s.key)).toEqual(["day", "screenshot", "upload", "prices", "link", "nutrition", "everyday"]);
    expect(ONE_ON_ONE_STEPS[0].target).toEqual({ tab: "OneToday", open: "setup" });
    expect(ONE_ON_ONE_STEPS[2].target).toEqual({ tab: "OneCalendar", open: "import" });
  });
  it("Evolution shows where the programs are", () => {
    expect(EVOLUTION_STEPS.some((s) => s.target?.tab === "Programs")).toBe(true);
  });
  it("steps are short, unique and never suggest oats", () => {
    for (const steps of [ONE_ON_ONE_STEPS, EVOLUTION_STEPS]) {
      expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
      for (const s of steps) expect(s.text.length).toBeLessThan(200);
      expect(JSON.stringify(steps).toLowerCase()).not.toMatch(/\boats?\b/);
    }
  });
  it("starts 1 on 1 for a trainer with no session setup, never for the owner or twice", () => {
    const info = { hasSettings: false, side: "one" as const, evolutionOn: false };
    expect(shouldAutoStart("one", {}, trainer, info)).toBe(true);
    expect(shouldAutoStart("one", {}, trainer, { ...info, hasSettings: true })).toBe(false);
    expect(shouldAutoStart("one", {}, { ...trainer, is_owner: true }, info)).toBe(false);
    expect(shouldAutoStart("one", { one: { step: 2, status: "stopped" } }, trainer, info)).toBe(false);
  });
  it("offers the start-to-finish Evolution guide once to every Evolution trainer", () => {
    const info = { hasSettings: true, side: "evo" as const, evolutionOn: true };
    expect(shouldAutoStart("evo", {}, trainer, info)).toBe(true);
    // Saw the short first guide: offered the new one once.
    expect(shouldAutoStart("evo", { evo: { step: 5, status: "done" } }, trainer, info)).toBe(true);
    expect(shouldAutoStart("evo", { evo: { step: 0, status: "stopped" }, evoV: EVO_GUIDE_VERSION }, trainer, info)).toBe(false);
    expect(shouldAutoStart("evo", {}, trainer, { ...info, side: "one" })).toBe(false);
    expect(shouldAutoStart("evo", {}, trainer, { ...info, evolutionOn: false })).toBe(false);
    expect(shouldAutoStart("evo", {}, { ...trainer, is_owner: true }, info)).toBe(false);
  });
  it("Evolution guide runs start to finish in four stages, each step with a tip or a page", () => {
    const stages = EVOLUTION_STEPS.map((s) => s.stage);
    expect(stages.every((st) => (EVOLUTION_STAGES as readonly string[]).includes(st ?? ""))).toBe(true);
    // Stages in order, none split up.
    const order = stages.filter((st, i) => st !== stages[i - 1]);
    expect(order).toEqual([...EVOLUTION_STAGES]);
    const keys = EVOLUTION_STEPS.map((s) => s.key);
    for (const k of ["prices", "pay", "code", "approve", "programs", "give", "diet", "checkins", "dashboard", "progress", "video", "challenges", "touch"]) expect(keys).toContain(k);
    for (const s of EVOLUTION_STEPS) {
      expect(s.tip || s.target).toBeTruthy();
      if (s.tip) expect(s.tip.length).toBeLessThan(120);
    }
    // Never a ready-made message to clients.
    expect(JSON.stringify(EVOLUTION_STEPS)).not.toMatch(/quick-send|ready-made message/i);
  });
  it("keeps a saved place inside the list when steps change", () => {
    expect(readGuideState(JSON.stringify({ evo: { step: 99, status: "running" } })).evo?.step).toBe(EVOLUTION_STEPS.length - 1);
  });
  it("shows the guide for the side the trainer is on first", () => {
    const both = { one: { step: 1, status: "running" as const }, evo: { step: 0, status: "running" as const } };
    expect(activeGuide(both, "evo")).toBe("evo");
    expect(activeGuide(both, "one")).toBe("one");
    expect(activeGuide({ one: { step: 1, status: "done" } }, "one")).toBe(null);
  });
  it("reads bad saved data as nothing", () => {
    expect(readGuideState("{oops")).toEqual({});
    expect(readGuideState(null)).toEqual({});
  });
  it("a page takes its Show me request once", () => {
    requestGuideOpen("import");
    expect(takeGuideOpen("setup")).toBe(false);
    expect(takeGuideOpen("import")).toBe(true);
    expect(takeGuideOpen("import")).toBe(false);
  });
});
