import { describe, expect, it } from "vitest";
import { TRAINER_GUIDES, trainerGuide } from "./trainerGuides";

describe("trainer guides", () => {
  it("has the guides GRIZZ asked for", () => {
    expect(TRAINER_GUIDES.map((g) => g.key)).toEqual(["retention", "nutrition", "training", "recovery", "sportsPerformance"]);
    expect(trainerGuide("training")?.topics.map((t) => t.title)).toEqual([
      "Principles for every muscle",
      "Chest",
      "Back",
      "Legs",
      "Calves",
      "Biceps",
      "Triceps",
      "Shoulders",
      "Gauge test (new clients)",
    ]);
  });

  it("gives every topic content and unique titles", () => {
    for (const guide of TRAINER_GUIDES) {
      const titles = guide.topics.map((t) => t.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const topic of guide.topics) {
        expect(topic.groups.length).toBeGreaterThan(0);
        for (const group of topic.groups) expect(group.points.length).toBeGreaterThan(0);
      }
    }
  });

  it("has a guide on working with injured clients, with the pain rule and referrals", () => {
    const topic = trainerGuide("recovery")?.topics.find((t) => t.title === "Working with injured clients");
    const text = JSON.stringify(topic);
    expect(text).toContain("biokineticist");
    expect(text).toContain("5 out of 10");
    expect(text).toContain("settled by the next morning");
  });

  it("never recommends oats or hack squats", () => {
    const text = JSON.stringify(TRAINER_GUIDES).toLowerCase();
    expect(text).not.toContain("oat");
    expect(text).not.toContain("hack squat");
  });
});
