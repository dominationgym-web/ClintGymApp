import { describe, expect, it } from "vitest";
import { foundationGoalFor, foundationLevelFor, foundationMessage, foundationProgramName, levelLabel } from "./foundation";

describe("foundation programs", () => {
  it("picks the level from the client's experience", () => {
    expect(foundationLevelFor("never")).toBe("Beginner");
    expect(foundationLevelFor("beginner")).toBe("Beginner");
    expect(foundationLevelFor("intermediate")).toBe("Intermediate");
    expect(foundationLevelFor("advanced")).toBeNull();
    expect(foundationLevelFor(null)).toBeNull();
  });

  it("picks the goal from the intake answers", () => {
    expect(foundationGoalFor("Gain muscle, Lose weight")).toBe("Weight loss");
    expect(foundationGoalFor("Gain muscle")).toBe("Bodybuilding");
    expect(foundationGoalFor("Get stronger")).toBe("Strength");
    expect(foundationGoalFor("General health and wellbeing")).toBe("Fitness");
    expect(foundationGoalFor(undefined)).toBe("Fitness");
  });

  it("names the program as the migration does", () => {
    expect(foundationProgramName("Beginner", "Weight loss")).toBe("Beginner Foundation - Weight loss");
  });

  it("writes the client's note", () => {
    const msg = foundationMessage("Sam", "never", "Beginner Foundation - Fitness");
    expect(msg).toContain("Hi Sam");
    expect(msg).toContain("new to training");
    expect(msg).toContain("6 weeks");
    expect(msg.length).toBeLessThan(2000);
    expect(levelLabel("intermediate")).toBe("Intermediate");
  });
});
