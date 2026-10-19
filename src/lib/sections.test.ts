import { describe, expect, it } from "vitest";
import { SECTIONS, findSection, sectionsFor } from "@/lib/sections";

describe("SECTIONS", () => {
  it("lists the sections in menu order", () => {
    expect(SECTIONS.map((s) => s.title)).toEqual([
      "Nutrition",
      "Supplementation",
      "Sleep",
      "Cycle tracker",
    ]);
  });

  it("has unique keys", () => {
    expect(new Set(SECTIONS.map((s) => s.key)).size).toBe(SECTIONS.length);
  });

  it.each(SECTIONS)("$title has a summary and either content or coming-soon topics", (section) => {
    expect(section.summary.length).toBeGreaterThan(0);
    expect((section.content?.length ?? 0) + section.topics.length).toBeGreaterThan(0);
  });

  it("finds a section by key", () => {
    expect(findSection("supplementation")?.title).toBe("Supplementation");
  });
});

describe("sectionsFor", () => {
  it("hides the Women's Health Reset from men only", () => {
    expect(sectionsFor("male").some((s) => s.key === "womensHealthReset")).toBe(false);
    expect(sectionsFor("female")).toEqual(SECTIONS);
    expect(sectionsFor(null)).toEqual(SECTIONS);
  });
});
