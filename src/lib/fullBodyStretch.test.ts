import { describe, expect, it } from "vitest";
import { FULL_BODY_STRETCH } from "./fullBodyStretch";

describe("full body stretch routine", () => {
  it("has a hold, how-to and video search for every stretch", () => {
    expect(FULL_BODY_STRETCH.length).toBe(12);
    for (const s of FULL_BODY_STRETCH) {
      expect(s.hold).toBeTruthy();
      expect(s.how.length).toBeGreaterThan(0);
      expect(s.search).toMatch(/^[a-z ]+$/);
    }
    expect(new Set(FULL_BODY_STRETCH.map((s) => s.name)).size).toBe(12);
  });
});
