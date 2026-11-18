import { describe, expect, it } from "vitest";

import { CANCEL_REASONS, cancelSummary } from "./cancelSubscription";

describe("cancelSummary", () => {
  it("says the end date, no refund, card removed and the 90 days", () => {
    const lines = cancelSummary("2026-12-31", 0);
    expect(lines[0]).toBe("You keep full use until 31 Dec 2026. Nothing renews after that.");
    expect(lines.join(" ")).toMatch(/no refund/);
    expect(lines.join(" ")).toMatch(/card is removed/);
    expect(lines.join(" ")).toMatch(/90 days/);
  });

  it("mentions referral free time", () => {
    expect(cancelSummary("2027-01-15", 1.5)[0]).toContain("including 1.5 free months from your referrals");
    expect(cancelSummary("2027-01-15", 1)[0]).toContain("including 1 free month from");
  });

  it("offers tap reasons only", () => {
    expect(CANCEL_REASONS).toContain("Too expensive");
    expect(CANCEL_REASONS.length).toBe(5);
  });
});
