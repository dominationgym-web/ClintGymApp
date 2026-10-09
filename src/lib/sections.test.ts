import { describe, expect, it } from "vitest";
import { SECTIONS, findSection } from "@/lib/sections";

describe("SECTIONS", () => {
  it("lists Nutrition, Supplementation and the Women's Health Reset in menu order", () => {
    expect(SECTIONS.map((s) => s.title)).toEqual(["Nutrition", "Supplementation", "Women's Health Reset"]);
  });

  it("has unique keys", () => {
    expect(new Set(SECTIONS.map((s) => s.key)).size).toBe(SECTIONS.length);
  });

  it.each(SECTIONS)("$title has a summary and at least one topic", (section) => {
    expect(section.summary.length).toBeGreaterThan(0);
    expect(section.topics.length).toBeGreaterThan(0);
  });

  it("finds a section by key", () => {
    expect(findSection("supplementation")?.title).toBe("Supplementation");
  });
});
