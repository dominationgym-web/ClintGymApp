import { describe, expect, it } from "vitest";
import { RECOVERY_ACTIVITIES, RECOVERY_PROGRAMS, dayLabel, durationText, findRecoveryActivity, planDayChoices, recoveryShortName } from "@/lib/recoveryActivities";

describe("recovery activities", () => {
  it("has eight activities, each with duration, benefits, steps and safety", () => {
    expect(RECOVERY_ACTIVITIES).toHaveLength(8);
    for (const a of RECOVERY_ACTIVITIES) {
      expect(a.how.length).toBeGreaterThanOrEqual(2);
      expect(a.benefits && a.safety && a.durationLabel).toBeTruthy();
    }
  });
  it("has three programs built on real activities", () => {
    expect(RECOVERY_PROGRAMS.map((p) => p.key)).toEqual(["training", "sports", "lifestyle"]);
    for (const p of RECOVERY_PROGRAMS) for (const a of p.activities) expect(findRecoveryActivity(a)).toBeDefined();
  });
  it("writes durations", () => {
    expect(durationText(480)).toBe("8 h");
    expect(durationText(450)).toBe("7.5 h");
    expect(durationText(10)).toBe("10 min");
  });
  it("never mentions oats", () => {
    expect(JSON.stringify(RECOVERY_ACTIVITIES).toLowerCase()).not.toContain("oat");
  });
  it("gives short calendar names", () => {
    expect(recoveryShortName("foam_rolling")).toBe("Foam roll");
    expect(recoveryShortName("cold")).toBe("Cold");
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
