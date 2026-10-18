import { describe, expect, it } from "vitest";
import {
  averageCycleLength,
  CYCLE_PHASES,
  cycleToday,
  daysBetween,
  phaseForDay,
  PHASE_ORDER,
  nextPeriodStarts,
  supplementPrepDates,
  supplementPrepDaysLeft,
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

describe("supplement check a week before her period", () => {
  it("predicts her next periods from her usual length", () => {
    expect(nextPeriodStarts(["2026-09-01", "2026-09-29"], "2026-10-05", 2)).toEqual(["2026-10-27", "2026-11-24"]);
    expect(nextPeriodStarts([], "2026-10-05", 2)).toEqual([]);
  });
  it("reminds her 7 days before each one, skipping a day already gone", () => {
    expect(supplementPrepDates(["2026-09-01", "2026-09-29"], "2026-10-05", 3)).toEqual([
      "2026-10-20",
      "2026-11-17",
      "2026-12-15",
    ]);
    // Period due in 3 days: this month's reminder has passed, so the next one is first.
    expect(supplementPrepDates(["2026-09-01", "2026-09-29"], "2026-10-24", 1)).toEqual(["2026-11-17"]);
  });
  it("shows the in-app list only in the week before", () => {
    const starts = ["2026-09-01", "2026-09-29"];
    expect(supplementPrepDaysLeft(cycleToday(starts, "2026-10-20"), "2026-10-20")).toBe(7);
    expect(supplementPrepDaysLeft(cycleToday(starts, "2026-10-26"), "2026-10-26")).toBe(1);
    expect(supplementPrepDaysLeft(cycleToday(starts, "2026-10-19"), "2026-10-19")).toBeNull();
    // Late: the due notice covers it instead.
    expect(supplementPrepDaysLeft(cycleToday(starts, "2026-10-28"), "2026-10-28")).toBeNull();
  });
});

describe("safe content (nutrition review, 2026-10-18)", () => {
  it("keeps B6 to 10 mg, magnesium to 350 mg, and has no fixed strength windows", async () => {
    const c = await import("./cycle");
    const all = JSON.stringify([c.CYCLE_PHASES, c.WOMENS_HEALTH_GUIDE, c.SUPPLEMENT_PREP_LIST, c.SUPPLEMENT_PREP_BODY]);
    expect(all).not.toMatch(/\b50 mg|400 mg|best window|clear used hormones|handles carbs well/);
    expect(c.SUPPLEMENT_PREP_BODY).toMatch(/10 mg a day or less/);
    expect(all).toMatch(/ferritin/);
    expect(all).toMatch(/RED-S/);
  });
});
