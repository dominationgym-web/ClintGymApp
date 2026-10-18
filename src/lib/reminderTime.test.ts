import { describe, expect, it } from "vitest";
import { habitReminderSlots, MAX_HABIT_REMINDERS, parseReminderTime } from "./reminderTime";

describe("parseReminderTime", () => {
  it("accepts the strict HH:MM form", () => {
    expect(parseReminderTime("08:00")).toBe("08:00");
    expect(parseReminderTime("18:30")).toBe("18:30");
  });

  it("accepts the ways people actually type a time on a phone", () => {
    expect(parseReminderTime("8:00")).toBe("08:00");
    expect(parseReminderTime("8.15")).toBe("08:15");
    expect(parseReminderTime("8h30")).toBe("08:30");
    expect(parseReminderTime("18 30")).toBe("18:30");
    expect(parseReminderTime(" 7:05 ")).toBe("07:05");
    expect(parseReminderTime("8")).toBe("08:00");
    expect(parseReminderTime("18")).toBe("18:00");
    expect(parseReminderTime("830")).toBe("08:30");
    expect(parseReminderTime("0800")).toBe("08:00");
    expect(parseReminderTime("1830")).toBe("18:30");
  });

  it("rejects things that aren't a time", () => {
    expect(parseReminderTime("")).toBeNull();
    expect(parseReminderTime("abc")).toBeNull();
    expect(parseReminderTime("24:00")).toBeNull();
    expect(parseReminderTime("12:60")).toBeNull();
    expect(parseReminderTime("8:5")).toBeNull();
    expect(parseReminderTime("12345")).toBeNull();
  });
});

describe("habitReminderSlots", () => {
  const habit = { id: "h1", name: "Drink water", active_days: [1, 3], reminder_enabled: true, reminder_time: "08:30:00", end_date: null };

  it("makes one weekly reminder per active day", () => {
    expect(habitReminderSlots([habit], "2026-10-18")).toEqual([
      { id: "habit-h1-1", habitName: "Drink water", weekday: 2, hour: 8, minute: 30 },
      { id: "habit-h1-3", habitName: "Drink water", weekday: 4, hour: 8, minute: 30 },
    ]);
  });

  it("skips switched-off, timeless and stopped habits", () => {
    expect(habitReminderSlots([{ ...habit, reminder_enabled: false }], "2026-10-18")).toEqual([]);
    expect(habitReminderSlots([{ ...habit, reminder_time: null }], "2026-10-18")).toEqual([]);
    expect(habitReminderSlots([{ ...habit, end_date: "2026-10-17" }], "2026-10-18")).toEqual([]);
  });

  it("stops at the cap", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...habit, id: `h${i}`, active_days: [0, 1, 2, 3, 4, 5, 6] }));
    expect(habitReminderSlots(many, "2026-10-18")).toHaveLength(MAX_HABIT_REMINDERS);
  });
});
