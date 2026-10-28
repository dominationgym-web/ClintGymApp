import { describe, expect, it } from "vitest";
import {
  eftRows,
  isValidSignature,
  logoStoragePath,
  needsAgreement,
  normalizeJoinCode,
  referralRewards,
  countedReferrals,
  referralStatusLabel,
  trainerDisplayName,
  trialDaysLeft,
  trialLabel,
} from "./trainers";

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

describe("trainer trial", () => {
  it("counts the days left, across months", () => {
    expect(trialDaysLeft("2026-10-25", "2026-10-11")).toBe(14);
    expect(trialDaysLeft("2026-11-02", "2026-10-30")).toBe(3);
    expect(trialDaysLeft("2026-10-11", "2026-10-11")).toBe(0);
    expect(trialDaysLeft("2026-10-10", "2026-10-11")).toBe(-1);
    expect(trialDaysLeft(null, "2026-10-11")).toBeNull();
  });

  it("words it for the profile", () => {
    expect(trialLabel("2026-10-12", "2026-10-11")).toBe("Free trial: 1 day left");
    expect(trialLabel("2026-10-16", "2026-10-11")).toBe("Free trial: 5 days left");
    expect(trialLabel("2026-10-11", "2026-10-11")).toBe("Free trial ends today");
    expect(trialLabel("2026-10-01", "2026-10-11")).toBe("Free trial ended");
    expect(trialLabel(null, "2026-10-11")).toBeNull();
  });
});

describe("referral counting", () => {
  it("counts only referrals stamped as counted", () => {
    const everyone = [
      { referred_by: "a", referral_counted_at: "2027-05-01T06:15:00Z" },
      { referred_by: "a", referral_counted_at: null },
      { referred_by: "b", referral_counted_at: "2027-05-01T06:15:00Z" },
    ];
    expect(countedReferrals(everyone, "a")).toBe(1);
    expect(countedReferrals(everyone, "c")).toBe(0);
  });

  it("labels each referral row", () => {
    expect(referralStatusLabel({ approved: false, counts_from: null, counted: false })).toBe("Waiting for approval");
    expect(referralStatusLabel({ approved: true, counts_from: "2027-04-30", counted: false })).toBe("Counts from 30 Apr 2027");
    expect(referralStatusLabel({ approved: true, counts_from: "2027-04-30", counted: true })).toBe("+25%");
  });
});

describe("referralRewards", () => {
  it("gives 25% per approved referral and a free month per 4", () => {
    expect(referralRewards(0, 0)).toEqual({ earned: 0, unused: 0, unusedPercent: 0, freeMonths: 0, toNextFreeMonth: 4 });
    expect(referralRewards(3, 0)).toMatchObject({ unusedPercent: 75, freeMonths: 0, toNextFreeMonth: 1 });
    expect(referralRewards(4, 0)).toMatchObject({ unusedPercent: 100, freeMonths: 1, toNextFreeMonth: 4 });
    expect(referralRewards(5, 2)).toMatchObject({ unused: 3, unusedPercent: 75, freeMonths: 0 });
    expect(referralRewards(1, 3)).toMatchObject({ unused: 0 });
  });
});

describe("needsAgreement", () => {
  it("asks trainers who haven't signed the current version", () => {
    expect(needsAgreement({ is_owner: false, agreement_version: null }, "v2")).toBe(true);
    expect(needsAgreement({ is_owner: false, agreement_version: "v1" }, "v2")).toBe(true);
    expect(needsAgreement({ is_owner: false, agreement_version: "v2" }, "v2")).toBe(false);
  });

  it("never asks the app owner", () => {
    expect(needsAgreement({ is_owner: true, agreement_version: null }, "v2")).toBe(false);
  });
});

describe("isValidSignature", () => {
  it("needs at least two characters", () => {
    expect(isValidSignature("  ")).toBe(false);
    expect(isValidSignature("A ")).toBe(false);
    expect(isValidSignature("Sam Smith")).toBe(true);
  });
});
