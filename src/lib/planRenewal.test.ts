import { describe, expect, it } from "vitest";
import { planDays, renewedPlanDates } from "@/lib/planRenewal";

const today = new Date(2026, 9, 18); // 18 Oct 2026, local

describe("renewedPlanDates", () => {
  it("adds the new plan on from the current end date when paying early", () => {
    const dates = renewedPlanDates(
      { access_status: "expiring_soon", plan_type: "intro_1mo", plan_started_at: "2026-09-25", plan_expires_at: "2026-10-25" },
      today
    );
    expect(dates).toEqual({ access_status: "active", plan_started_at: "2026-09-25", plan_expires_at: "2026-11-24" });
  });

  it("starts again today for an expired client", () => {
    const dates = renewedPlanDates(
      { access_status: "expired", plan_type: "sub_6mo", plan_started_at: "2026-01-01", plan_expires_at: "2026-06-30" },
      today
    );
    expect(dates?.plan_started_at).toBe("2026-10-18");
    expect(dates?.plan_expires_at).toBe("2027-04-16");
  });

  it("starts today when the end date has already passed", () => {
    const dates = renewedPlanDates(
      { access_status: "active", plan_type: "intro_1mo", plan_started_at: "2026-09-01", plan_expires_at: "2026-10-01" },
      today
    );
    expect(dates?.plan_started_at).toBe("2026-10-18");
    expect(dates?.plan_expires_at).toBe("2026-11-17");
  });

  it("needs a plan type", () => {
    expect(
      renewedPlanDates({ access_status: "active", plan_type: null, plan_started_at: null, plan_expires_at: null }, today)
    ).toBeNull();
    expect(planDays("sub_12mo")).toBe(365);
  });
});
