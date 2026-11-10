import { describe, expect, it } from "vitest";
import { EVOLUTION_STEPS, ONE_ON_ONE_STEPS, activeGuide, readGuideState, requestGuideOpen, shouldAutoStart, takeGuideOpen } from "./setupGuide";

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
  it("starts Evolution only for trainers who switch it on from now", () => {
    const info = { hasSettings: true, side: "evo" as const, evolutionOn: true };
    expect(shouldAutoStart("evo", {}, { ...trainer, evolution_started_on: "2026-11-12" }, info)).toBe(true);
    expect(shouldAutoStart("evo", {}, { ...trainer, evolution_started_on: "2026-11-01" }, info)).toBe(false);
    expect(shouldAutoStart("evo", {}, { ...trainer, evolution_started_on: "2026-11-12" }, { ...info, side: "one" })).toBe(false);
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
