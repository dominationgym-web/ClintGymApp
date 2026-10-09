import { describe, expect, it } from "vitest";
import { eftRows, logoStoragePath, normalizeJoinCode, trainerDisplayName } from "./trainers";

describe("eftRows", () => {
  it("keeps the screen order and drops empty fields", () => {
    expect(eftRows({ account_number: "123", bank: " Discovery ", branch_code: "" })).toEqual([
      { label: "Bank", value: "Discovery" },
      { label: "Account number", value: "123" },
    ]);
  });

  it("handles a trainer who hasn't filled anything in", () => {
    expect(eftRows({})).toEqual([]);
    expect(eftRows(null)).toEqual([]);
  });
});

describe("normalizeJoinCode", () => {
  it("upper-cases and strips spaces", () => {
    expect(normalizeJoinCode(" ab c12 ")).toBe("ABC12");
  });
});

describe("trainerDisplayName", () => {
  it("prefers the business name", () => {
    expect(trainerDisplayName({ name: "Sam", business_name: "Sam Fit" })).toBe("Sam Fit");
    expect(trainerDisplayName({ name: "Sam", business_name: "  " })).toBe("Sam");
    expect(trainerDisplayName({ name: "Sam" })).toBe("Sam");
  });
});

describe("logoStoragePath", () => {
  it("lives in the trainer's own folder", () => {
    expect(logoStoragePath("t1", "image/png", 5)).toBe("t1/logo-5.png");
    expect(logoStoragePath("t1", undefined, 5)).toBe("t1/logo-5.jpg");
  });
});
