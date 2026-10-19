import { describe, expect, it } from "vitest";
import { planEndingSoon, planEndingWhen } from "@/lib/planEnding";

describe("planEndingSoon", () => {
  it("shows in the last 7 days, today included", () => {
    expect(planEndingSoon("2026-10-25T12:00:00", "2026-10-18")).toEqual({ endsOn: "2026-10-25", daysLeft: 7 });
    expect(planEndingSoon("2026-10-18T12:00:00", "2026-10-18")?.daysLeft).toBe(0);
  });
  it("stays away before then, after it has ended, or with no plan date", () => {
    expect(planEndingSoon("2026-10-26T12:00:00", "2026-10-18")).toBeNull();
    expect(planEndingSoon("2026-10-17T12:00:00", "2026-10-18")).toBeNull();
    expect(planEndingSoon(null, "2026-10-18")).toBeNull();
  });
});

describe("planEndingWhen", () => {
  it("says today and tomorrow in words", () => {
    expect(planEndingWhen({ endsOn: "2026-10-18", daysLeft: 0 })).toBe("today");
    expect(planEndingWhen({ endsOn: "2026-10-19", daysLeft: 1 })).toBe("tomorrow");
    expect(planEndingWhen({ endsOn: "2026-10-23", daysLeft: 5 })).toMatch(/^on /);
  });
});
