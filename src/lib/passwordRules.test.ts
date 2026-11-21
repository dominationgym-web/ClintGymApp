import { describe, expect, it } from "vitest";
import { cleanResetCode, passwordProblem, resetCodeProblem } from "./passwordRules";

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

describe("cleanResetCode", () => {
  it("keeps only the digits", () => {
    expect(cleanResetCode(" 123 456 ")).toBe("123456");
    expect(cleanResetCode("Code: 987654")).toBe("987654");
  });
});

describe("resetCodeProblem", () => {
  it("explains a wrong or old code", () => {
    expect(resetCodeProblem("Token has expired or is invalid")).toMatch(/wrong or too old/);
  });
  it("explains asking too often", () => {
    expect(resetCodeProblem("For security purposes, you can only request this after 42 seconds.")).toMatch(/Wait a minute/);
    expect(resetCodeProblem("email rate limit exceeded")).toMatch(/Wait a minute/);
  });
  it("points to the trainer when the email can't go out", () => {
    expect(resetCodeProblem("Error sending recovery email")).toMatch(/trainer/);
  });
});
