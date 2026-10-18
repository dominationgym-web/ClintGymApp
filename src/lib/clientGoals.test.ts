import { describe, expect, it } from "vitest";
import { clientGoals } from "@/lib/clientGoals";

describe("clientGoals", () => {
  it("prefers what the trainer typed", () => {
    expect(clientGoals({ goals: "Deadlift 100kg", intake_responses: { training_goals: "Get stronger" } })).toBe("Deadlift 100kg");
  });
  it("falls back to the intake form goals", () => {
    expect(clientGoals({ goals: null, intake_responses: { training_goals: "Lose weight, Get stronger" } })).toBe("Lose weight, Get stronger");
    expect(clientGoals({ goals: "  ", intake_responses: {} })).toBe("");
  });
});
