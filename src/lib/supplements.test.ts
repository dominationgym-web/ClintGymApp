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
