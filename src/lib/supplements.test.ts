import { describe, expect, it } from "vitest";
import { SUPPLEMENT_LEVELS, SUPPLEMENTS } from "./supplements";

describe("supplement cards", () => {
  it("fills in every part of every card", () => {
    for (const s of SUPPLEMENTS) {
      for (const text of [s.name, s.what, s.who, s.how, s.careful]) expect(text.trim()).not.toBe("");
    }
  });

  it("uses only the labels explained on the page, with no duplicate names", () => {
    const levels = SUPPLEMENT_LEVELS.map((l) => l.level);
    for (const s of SUPPLEMENTS) expect(levels).toContain(s.level);
    expect(new Set(SUPPLEMENTS.map((s) => s.name)).size).toBe(SUPPLEMENTS.length);
  });
});

describe("three tiers (nutrition review, 2026-10-18)", () => {
  it("lists Worth it, then Might help, then Skip", () => {
    const order = SUPPLEMENTS.map((s) => SUPPLEMENT_LEVELS.findIndex((l) => l.level === s.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(SUPPLEMENTS.filter((s) => s.level === "Worth it").map((s) => s.name)).toEqual(["Creatine monohydrate", "Protein powder", "Caffeine"]);
  });
  it("puts vitamin D under Might help with its upper limit, and adds beetroot", () => {
    const d = SUPPLEMENTS.find((s) => s.name === "Vitamin D3")!;
    expect(d.level).toBe("Might help");
    expect(d.careful).toMatch(/4,000 IU/);
    expect(SUPPLEMENTS.find((s) => s.name.startsWith("Beetroot"))?.how).toMatch(/2 to 3 hours before/);
  });
});

describe("doses (nutrition review, 2026-10-18)", () => {
  const card = (name: string) => SUPPLEMENTS.find((s) => s.name.startsWith(name))!;
  it("keeps magnesium within the 350 mg supplement limit", () => {
    expect(card("Magnesium").how).toMatch(/200 to 350 mg/);
    expect(card("Magnesium").how).not.toMatch(/400/);
  });
  it("warns about ashwagandha and the liver, and omega-3 and heart rhythm", () => {
    expect(card("Ashwagandha").careful).toMatch(/liver/);
    expect(card("Ashwagandha").careful).toMatch(/thyroid/);
    expect(card("Omega-3").careful).toMatch(/irregular heartbeat/);
    expect(card("Omega-3").careful).toMatch(/blood thinners/);
  });
  it("gives caffeine per ISSN and beta-alanine as a daily build-up", () => {
    expect(card("Caffeine").how).toMatch(/3 to 6 mg per kg of body weight, about 60 minutes before/);
    expect(card("Beta-alanine").level).toBe("Might help");
    expect(card("Beta-alanine").how).toMatch(/every day/);
  });
});
