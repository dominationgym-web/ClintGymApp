import { describe, expect, it } from "vitest";
import { CLIENT_APP_GUIDE, TRAINER_APP_GUIDE } from "./appGuide";

describe("app guide", () => {
  for (const [who, guide] of [["client", CLIENT_APP_GUIDE], ["trainer", TRAINER_APP_GUIDE]] as const) {
    it(`${who}: every topic has a unique key, a place and points`, () => {
      const keys = guide.topics.map((t) => t.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const t of guide.topics) {
        expect(t.where.length).toBeGreaterThan(0);
        expect(t.points.length).toBeGreaterThan(0);
      }
    });
    it(`${who}: keeps to the coach's rules (no oats)`, () => {
      expect(JSON.stringify(guide).toLowerCase()).not.toMatch(/\boats?\b/);
    });
  }
});
