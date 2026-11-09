import { describe, expect, it } from "vitest";
import { passwordProblem } from "./passwordRules";

describe("passwordProblem", () => {
  it("wants at least 8 characters", () => {
    expect(passwordProblem("short", "short")).toMatch(/8/);
  });
  it("wants both boxes the same", () => {
    expect(passwordProblem("longenough", "longenougH")).toMatch(/match/);
  });
  it("accepts a good password", () => {
    expect(passwordProblem("longenough", "longenough")).toBeNull();
  });
});
