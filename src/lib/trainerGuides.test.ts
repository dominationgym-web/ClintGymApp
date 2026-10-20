import { describe, expect, it } from "vitest";
import { TRAINER_GUIDES, trainerGuide } from "./trainerGuides";

describe("trainer guides", () => {
  it("has the guides GRIZZ asked for", () => {
    expect(TRAINER_GUIDES.map((g) => g.key)).toEqual([
      "referral",
      "retention",
      "nutrition",
      "training",
      "recovery",
      "womensHealth",
      "longevity",
      "sportsPerformance",
    ]);
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

  it("has a When to refer guide at the top, pointing to the detailed red flags", () => {
    const guide = trainerGuide("referral");
    expect(TRAINER_GUIDES[0]).toBe(guide);
    const text = JSON.stringify(guide);
    for (const who of ["GP", "Physiotherapist", "Biokineticist", "Registered dietitian", "adsa.org.za", "Psychologist", "0800 567 567"]) {
      expect(text).toContain(who);
    }
    expect(text).toContain("Working with injured clients");
    expect(text).toContain("Nutrition: when to refer");
    expect(text).toMatch(/don't diagnose, treat or prescribe/);
    // The topics it points to exist.
    expect(trainerGuide("recovery")?.topics.some((t) => t.title === "Working with injured clients")).toBe(true);
    expect(trainerGuide("nutrition")?.topics.some((t) => t.title === "Nutrition: when to refer")).toBe(true);
    expect(trainerGuide("womensHealth")?.topics.map((t) => t.title)).toEqual(["Perimenopause and menopause", "Iron and RED-S"]);
  });

  it("covers menopause training and food, and iron and RED-S, leaving treatment to the doctor", () => {
    const [menopause, iron] = trainerGuide("womensHealth")!.topics.map((t) => JSON.stringify(t).toLowerCase());
    for (const word of ["progressive loads", "impact", "1.2 to 1.6 g", "calcium", "vitamin d", "creatine", "hot flushes", "hrt", "doctor"]) {
      expect(menopause).toContain(word);
    }
    for (const word of ["periods", "stress fractures", "tiredness", "low mood", "performance dropping", "vitamin c", "ferritin", "heavy periods", "dietitian"]) {
      expect(iron).toContain(word);
    }
  });

  it("never recommends oats or hack squats", () => {
    const text = JSON.stringify(TRAINER_GUIDES).toLowerCase();
    expect(text).not.toContain("oat");
    expect(text).not.toContain("hack squat");
  });
});
