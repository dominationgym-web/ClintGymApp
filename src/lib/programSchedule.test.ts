import { describe, expect, it } from "vitest";
import {
  addDays,
  currentSession,
  firstTrainingDateFrom,
  isDue,
  nextDayInCycle,
  sessionAfterComplete,
  sessionMovedToTomorrow,
  sessionTitle,
  trainingDays,
  weekdayOf,
} from "@/lib/programSchedule";

// 2026-10-05 is a Monday.
const MON = "2026-10-05";
const TUE = "2026-10-06";
const WED = "2026-10-07";
const THU = "2026-10-08";
const FRI = "2026-10-09";
const NEXT_MON = "2026-10-12";
const MWF = [1, 3, 5];

describe("trainingDays", () => {
  it("lists each day once, in order", () => {
    expect(trainingDays([{ day_number: 5 }, { day_number: 1 }, { day_number: 5 }, { day_number: 3 }])).toEqual(MWF);
  });
});

describe("dates", () => {
  it("adds days across a month end", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("finds the first training day on or after a date", () => {
    expect(firstTrainingDateFrom(MON, MWF)).toBe(MON);
    expect(firstTrainingDateFrom(TUE, MWF)).toBe(WED);
    expect(firstTrainingDateFrom("2026-10-10", MWF)).toBe(NEXT_MON);
  });

  it("wraps to the start of the week after the last session", () => {
    expect(nextDayInCycle(1, MWF)).toBe(3);
    expect(nextDayInCycle(5, MWF)).toBe(1);
  });
});

describe("currentSession", () => {
  it("starts on the first training day from the start date", () => {
    expect(currentSession({ started_on: TUE, current_day: null, due_on: null }, MWF)).toEqual({ day: 3, dueOn: WED });
  });

  it("uses saved progress once there is some", () => {
    expect(currentSession({ started_on: MON, current_day: 5, due_on: THU }, MWF)).toEqual({ day: 5, dueOn: THU });
  });

  it("ignores saved progress for a day the program no longer has", () => {
    expect(currentSession({ started_on: MON, current_day: 2, due_on: TUE }, MWF)).toEqual({ day: 1, dueOn: MON });
  });

  it("has nothing for a program with no exercises", () => {
    expect(currentSession({ started_on: MON, current_day: null, due_on: null }, [])).toBeNull();
  });
});

describe("working through the week", () => {
  it("unlocks the next session on the next training day after completing", () => {
    expect(sessionAfterComplete({ day: 1, dueOn: MON }, MWF, MON)).toEqual({ day: 3, dueOn: WED });
  });

  it("keeps the order when a session is done late", () => {
    // Monday's session done on Thursday: Wednesday's session is next, on Friday.
    expect(sessionAfterComplete({ day: 1, dueOn: MON }, MWF, THU)).toEqual({ day: 3, dueOn: FRI });
  });

  it("moves a session to tomorrow without changing which one it is", () => {
    expect(sessionMovedToTomorrow({ day: 3, dueOn: WED }, WED)).toEqual({ day: 3, dueOn: THU });
  });

  it("keeps a missed session due until it is completed", () => {
    expect(isDue({ day: 1, dueOn: MON }, THU)).toBe(true);
    expect(isDue({ day: 3, dueOn: WED }, TUE)).toBe(false);
  });
});

describe("sessionTitle", () => {
  it("uses the day's title, or the weekday", () => {
    expect(sessionTitle({ day_titles: ["Workout A", "", "Workout B"] }, 1)).toBe("Workout A");
    expect(sessionTitle({ day_titles: ["Workout A", "", "Workout B"] }, 2)).toBe("Tuesday");
    expect(sessionTitle({ day_titles: [] }, 5)).toBe("Friday");
  });
});

describe("weekdayOf", () => {
  it("names the day of a date", () => {
    expect(weekdayOf(WED)).toBe("Wednesday");
    expect(weekdayOf("2026-10-11")).toBe("Sunday");
  });
});
