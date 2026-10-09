import { describe, expect, it } from "vitest";
import {
  averageCycleLength,
  CYCLE_PHASES,
  cycleToday,
  daysBetween,
  phaseForDay,
  PHASE_ORDER,
  upcomingPhases,
  WOMENS_HEALTH_GUIDE,
} from "@/lib/cycle";

describe("phaseForDay", () => {
  it("follows a typical 28-day cycle", () => {
    expect(phaseForDay(1, 28)).toBe("menstrual");
    expect(phaseForDay(5, 28)).toBe("menstrual");
    expect(phaseForDay(6, 28)).toBe("follicular");
    expect(phaseForDay(12, 28)).toBe("follicular");
    expect(phaseForDay(13, 28)).toBe("ovulation");
    expect(phaseForDay(15, 28)).toBe("ovulation");
    expect(phaseForDay(16, 28)).toBe("luteal");
    expect(phaseForDay(28, 28)).toBe("luteal");
  });

  it("moves ovulation with a longer cycle", () => {
    expect(phaseForDay(16, 34)).toBe("follicular");
    expect(phaseForDay(20, 34)).toBe("ovulation");
  });
});

describe("averageCycleLength", () => {
  it("is 28 until there are two periods", () => {
    expect(averageCycleLength([])).toBe(28);
    expect(averageCycleLength(["2026-09-01"])).toBe(28);
  });

  it("averages the gaps, in any order", () => {
    expect(averageCycleLength(["2026-08-30", "2026-07-01", "2026-07-31"])).toBe(30);
  });

  it("ignores gaps that can't be one cycle", () => {
    // 2026-05-01 to 2026-07-01 is a missed log (61 days).
    expect(averageCycleLength(["2026-05-01", "2026-07-01", "2026-07-27"])).toBe(26);
  });
});

describe("cycleToday", () => {
  it("is null before she logs a period", () => {
    expect(cycleToday([], "2026-10-09")).toBeNull();
  });

  it("counts day 1 as the day the period started", () => {
    const t = cycleToday(["2026-10-01"], "2026-10-01")!;
    expect(t.cycleDay).toBe(1);
    expect(t.phase.key).toBe("menstrual");
    expect(t.nextPeriodOn).toBe("2026-10-29");
  });

  it("knows the phase partway through", () => {
    expect(cycleToday(["2026-10-01"], "2026-10-09")!.phase.key).toBe("follicular");
    expect(cycleToday(["2026-10-01"], "2026-10-20")!.phase.key).toBe("luteal");
  });

  it("flags a period that's due", () => {
    const t = cycleToday(["2026-09-01"], "2026-09-30")!;
    expect(t.periodDue).toBe(true);
    expect(t.phase.key).toBe("luteal");
  });

  it("ignores a date logged in the future", () => {
    expect(cycleToday(["2026-10-01", "2026-12-01"], "2026-10-02")!.cycleDay).toBe(2);
  });
});

describe("upcomingPhases", () => {
  it("rolls into the next predicted cycle", () => {
    const days = upcomingPhases(["2026-10-01"], "2026-10-28", 3);
    expect(days.map((d) => d.phase.key)).toEqual(["luteal", "menstrual", "menstrual"]);
    expect(days[1].date).toBe("2026-10-29");
  });
});

describe("content", () => {
  it("has every part of the guide for every phase", () => {
    for (const key of PHASE_ORDER) {
      const p = CYCLE_PHASES[key];
      expect(p.feel.length && p.training.length && p.nutrition.length && p.supplements.length).toBeTruthy();
      expect(p.reminder).toBeTruthy();
    }
    expect(WOMENS_HEALTH_GUIDE.length).toBeGreaterThan(5);
  });

  it("counts days across a month end", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});
