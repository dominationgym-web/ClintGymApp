import { describe, expect, it } from "vitest";
import { CLIENT_PAGES, matchesAll, searchPages, searchSections, searchWords } from "@/lib/appSearch";
import type { Section } from "@/lib/sections";

describe("searchWords and matchesAll", () => {
  it("needs every word, in any order, ignoring case", () => {
    expect(searchWords("  Progress  PHOTOS ")).toEqual(["progress", "photos"]);
    expect(matchesAll("Your progress photos", ["photos", "progress"])).toBe(true);
    expect(matchesAll("Your progress photos", ["photos", "video"])).toBe(false);
  });
  it("finds nothing for an empty search", () => {
    expect(matchesAll("anything", [])).toBe(false);
  });
});

describe("searchPages", () => {
  it("finds a page by what's on it", () => {
    expect(searchPages(CLIENT_PAGES, "progress photos").map((p) => p.tab)).toEqual(["Profile"]);
    expect(searchPages(CLIENT_PAGES, "rest timer").map((p) => p.tab)).toEqual(["Exercises"]);
  });
});

describe("searchSections", () => {
  const sections: Section[] = [
    { key: "nutrition", title: "Nutrition", summary: "How to eat.", topics: ["Meal plans and meal ideas"] },
    {
      key: "sleepRecovery",
      title: "Sleep & Recovery",
      summary: "Better sleep.",
      topics: [],
      content: [{ heading: "The basics", points: ["Aim for 7 to 9 hours.", "Keep caffeine before noon."] }],
    },
  ];
  it("matches a title or summary", () => {
    expect(searchSections(sections, "nutrition")).toEqual([{ key: "nutrition", title: "Nutrition", snippet: "How to eat." }]);
  });
  it("shows the matching line from inside a guide", () => {
    expect(searchSections(sections, "caffeine")).toEqual([
      { key: "sleepRecovery", title: "Sleep & Recovery", snippet: "The basics: Keep caffeine before noon." },
    ]);
    expect(searchSections(sections, "meal")[0].key).toBe("nutrition");
  });
});
