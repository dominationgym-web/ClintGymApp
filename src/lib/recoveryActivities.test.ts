import { describe, expect, it } from "vitest";
import { RECOVERY_ACTIVITIES, dayLabel, planDayChoices, recoveryShortName } from "@/lib/recoveryActivities";

describe("recovery activities", () => {
  it("has eight simple activities with steps", () => {
    expect(RECOVERY_ACTIVITIES).toHaveLength(8);
    for (const a of RECOVERY_ACTIVITIES) expect(a.how.length).toBeGreaterThanOrEqual(3);
  });
  it("never mentions oats", () => {
    expect(JSON.stringify(RECOVERY_ACTIVITIES).toLowerCase()).not.toContain("oat");
  });
  it("gives short calendar names", () => {
    expect(recoveryShortName("foam_rolling")).toBe("Foam roll");
    expect(recoveryShortName("breathing")).toBe("Breathing");
  });
});

describe("planDayChoices", () => {
  it("labels the next week", () => {
    expect(planDayChoices("2026-10-17", 4)).toEqual([
      { date: "2026-10-17", label: "Today" },
      { date: "2026-10-18", label: "Tomorrow" },
      { date: "2026-10-19", label: "Mon 19" },
      { date: "2026-10-20", label: "Tue 20" },
    ]);
  });
  it("names past days too", () => {
    expect(dayLabel("2026-10-16", "2026-10-17")).toBe("Yesterday");
    expect(dayLabel("2026-10-14", "2026-10-17")).toBe("Wed 14");
  });
});
