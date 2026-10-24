import { describe, expect, it } from "vitest";
import {
  blockFirstSlot,
  programBlockWeeks,
  slotsFrom,
  daysLabel,
  defaultWeeks,
  findSplit,
  planProgramDates,
  planWeekDates,
  sessionsPerWeek,
  splitAlongside,
  splitNote,
  suggestedSplit,
  timesAWeekDays,
  toggleDay,
  TRAINING_SPLITS,
  weekdayOfIso,
  weeksToFinish,
} from "./trainingSplits";

describe("training splits", () => {
  it("never trains on a Sunday", () => {
    for (const s of TRAINING_SPLITS) expect(s.days).not.toContain(7);
  });

  it("knows the weekday of a date", () => {
    expect(weekdayOfIso("2026-10-19")).toBe(1); // Monday
    expect(weekdayOfIso("2026-10-18")).toBe(7); // Sunday
  });

  it("lays sessions in order on the split's days from the start day", () => {
    // Start on Wednesday 21 Oct, Mon/Wed/Fri, a 3-session program, 2 weeks.
    const plan = planProgramDates("2026-10-21", findSplit("mon_wed_fri").days, [1, 3, 5], 2);
    expect(plan).toEqual([
      { date: "2026-10-21", slot: 1 },
      { date: "2026-10-23", slot: 3 },
      { date: "2026-10-26", slot: 5 },
      { date: "2026-10-28", slot: 1 },
      { date: "2026-10-30", slot: 3 },
      { date: "2026-11-02", slot: 5 },
    ]);
  });

  it("starts on the next split day when the tapped day isn't one", () => {
    const plan = planProgramDates("2026-10-19", findSplit("tue_thu").days, [1, 4], 1);
    expect(plan.map((p) => p.date)).toEqual(["2026-10-20", "2026-10-22"]);
  });

  it("works through a multi-week program over more days a week", () => {
    const slots = [1, 3, 5, 8, 10, 12];
    const plan = planProgramDates("2026-10-19", findSplit("mon_sat").days, slots, 1);
    expect(plan.map((p) => p.slot)).toEqual([1, 3, 5, 8, 10, 12]);
    expect(plan.at(-1)!.date).toBe("2026-10-24");
  });

  it("suggests the split that matches the program", () => {
    expect(sessionsPerWeek([1, 3, 5, 8, 10, 12])).toBe(3);
    expect(suggestedSplit(2)).toBe("tue_thu");
    expect(suggestedSplit(3)).toBe("mon_wed_fri");
    expect(suggestedSplit(4)).toBe("mon_tue_thu_fri");
    expect(suggestedSplit(7)).toBe("mon_sat");
    expect(defaultWeeks(1)).toBe(4);
    expect(defaultWeeks(12)).toBe(12);
  });
});

describe("splitAlongside", () => {
  it("keeps days that already have a workout and adds the new session as an extra there", () => {
    const plan = [
      { date: "2026-10-19", slot: 1 },
      { date: "2026-10-20", slot: 3 },
      { date: "2026-10-21", slot: 5 },
    ];
    const { mains, extras } = splitAlongside(plan, ["2026-10-19", "2026-10-21", "2026-10-23"]);
    expect(mains.map((p) => p.date)).toEqual(["2026-10-20"]);
    expect(extras.map((p) => p.date)).toEqual(["2026-10-19", "2026-10-21"]);
  });
});

describe("a program on a split with a different number of days", () => {
  // A 4-day, 12-week program: Mon, Tue, Thu, Fri each week, easy weeks 4, 8 and 12.
  const slots = Array.from({ length: 12 }, (_, w) => [1, 2, 4, 5].map((d) => w * 7 + d)).flat();

  it("takes longer on fewer days, and says where the easy weeks land", () => {
    expect(weeksToFinish(slots.length, 2)).toBe(24);
    const plan = planProgramDates("2026-10-19", findSplit("tue_thu").days, slots, 24);
    expect(plan).toHaveLength(48);
    const note = splitNote(plan, 4, 2, slots.length, [4, 8, 12]);
    expect(note).toContain("takes 24 weeks");
    expect(note).toContain("program week 4 from calendar week 7");
  });

  it("warns about less rest on more days", () => {
    const fullBody = Array.from({ length: 4 }, (_, w) => [1, 3, 5].map((d) => w * 7 + d)).flat();
    const plan = planProgramDates("2026-10-19", findSplit("mon_fri").days, fullBody, 3);
    expect(splitNote(plan, 3, 5, fullBody.length, [])).toContain("less rest");
  });

  it("says nothing when the split matches", () => {
    const plan = planProgramDates("2026-10-19", findSplit("mon_tue_thu_fri").days, slots, 12);
    expect(splitNote(plan, 4, 4, slots.length, [4, 8, 12])).toBeNull();
  });
});

describe("trainer's own days", () => {
  it("taps days on and off, Monday to Saturday only", () => {
    expect(toggleDay([2], 5)).toEqual([2, 5]);
    expect(toggleDay([2, 5], 2)).toEqual([5]);
    expect(toggleDay([2], 7)).toEqual([2]);
    expect(daysLabel([5, 2])).toBe("Tue · Fri");
  });

  it("repeats picked days weekly like any split", () => {
    const plan = planProgramDates("2026-10-19", [2, 5], [1, 2, 3], 2);
    expect(plan).toEqual([
      { date: "2026-10-20", slot: 1 },
      { date: "2026-10-23", slot: 2 },
      { date: "2026-10-27", slot: 3 },
      { date: "2026-10-30", slot: 1 },
    ]);
  });

  it("carries the program on in order when next week's days are different", () => {
    // Week 1 placed 2 sessions; week 2 is Mon and Thu.
    expect(planWeekDates("2026-10-26", "2026-11-01", [1, 4], [1, 2, 3], 2)).toEqual([
      { date: "2026-10-26", slot: 3 },
      { date: "2026-10-29", slot: 1 },
    ]);
    expect(planWeekDates("2026-10-26", "2026-11-01", [], [1, 2], 0)).toEqual([]);
  });
});

describe("timesAWeekDays", () => {
  // 2026-10-21 is a Wednesday, 2026-10-25 a Sunday.
  it("trains on the start day once a week", () => {
    expect(timesAWeekDays("2026-10-21", 1)).toEqual([3]);
    expect(timesAWeekDays("2026-10-25", 1)).toEqual([1]);
  });
  it("leaves 2 rest days between twice-a-week sessions, never on a Sunday", () => {
    expect(timesAWeekDays("2026-10-21", 2)).toEqual([3, 6]);
    expect(timesAWeekDays("2026-10-22", 2)).toEqual([1, 4]);
    expect(timesAWeekDays("2026-10-25", 2)).toEqual([1, 4]);
  });
  it("spreads an 18-session program over 18 weeks once a week", () => {
    const plan = planProgramDates("2026-10-21", timesAWeekDays("2026-10-21", 1), Array.from({ length: 18 }, (_, i) => i + 1), weeksToFinish(18, 1));
    expect(plan).toHaveLength(18);
    expect(plan[17].date).toBe("2027-02-17");
  });
});

describe("start at block (0135)", () => {
  it("uses the sessions from that block on", () => {
    const slots = [1, 3, 5, 57, 59, 61, 113, 115, 117];
    expect(blockFirstSlot(1)).toBe(1);
    expect(blockFirstSlot(2)).toBe(57);
    expect(slotsFrom(slots, blockFirstSlot(2))).toEqual([57, 59, 61, 113, 115, 117]);
    expect(slotsFrom(slots, null)).toEqual(slots);
  });
});

describe("Muscle Year blocks (0150)", () => {
  it("runs in 13-week blocks, so block 4 starts at week 40", () => {
    expect(programBlockWeeks("Muscle Year – 4 days a week")).toBe(13);
    expect(programBlockWeeks("Older Adult 2 - Strength & Stability")).toBe(8);
    expect(programBlockWeeks("Bodybuilding 12-week program")).toBeNull();
    expect(blockFirstSlot(2, 13)).toBe(13 * 7 + 1);
    expect(blockFirstSlot(4, 13)).toBe(39 * 7 + 1);
  });
});
