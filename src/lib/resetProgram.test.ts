import { describe, expect, it } from "vitest";
import {
  RESET_HABITS,
  RESET_TRAINING,
  RESET_WEEKS,
  formatReminderTime,
  newHabits,
  resetWeekDates,
  resetWeekNumber,
  upcomingResetReminders,
} from "@/lib/resetProgram";

describe("RESET_WEEKS", () => {
  it("has 12 weeks in order, each with steps and habits", () => {
    expect(RESET_WEEKS.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const w of RESET_WEEKS) {
      expect(w.todo.length).toBeGreaterThan(0);
      expect(w.habits.length).toBeGreaterThan(0);
    }
  });

  it("only ever adds habits, and has all eight from week 4", () => {
    for (let week = 2; week <= 12; week++) {
      const before = RESET_WEEKS[week - 2].habits;
      expect(RESET_WEEKS[week - 1].habits).toEqual(expect.arrayContaining(before));
    }
    expect(RESET_WEEKS[3].habits.sort()).toEqual(RESET_HABITS.map((h) => h.key).sort());
  });

  it("flags what's new each week", () => {
    expect(newHabits(1)).toEqual([]);
    expect(newHabits(2)).toEqual(["consistent_sleep"]);
    expect(newHabits(3).sort()).toEqual(["aerobic_exercise", "protein_meals"]);
    expect(newHabits(5)).toEqual([]);
  });

  it("has no hack squats in any session", () => {
    const names = Object.values(RESET_TRAINING).flatMap((t) =>
      t.sessions.flatMap((s) => s.exercises.flatMap((e) => [e.name, e.or ?? ""]))
    );
    expect(names.some((n) => /hack/i.test(n))).toBe(false);
  });
});

describe("resetWeekNumber", () => {
  it("counts weeks from the start day", () => {
    expect(resetWeekNumber("2026-10-10", "2026-10-10")).toBe(1);
    expect(resetWeekNumber("2026-10-10", "2026-10-16")).toBe(1);
    expect(resetWeekNumber("2026-10-10", "2026-10-17")).toBe(2);
    expect(resetWeekNumber("2026-10-10", "2027-01-01")).toBe(12);
    expect(resetWeekNumber("2026-10-10", "2027-01-02")).toBe(13);
    expect(resetWeekNumber("2026-10-10", "2026-10-09")).toBe(0);
  });

  it("gives each week's first and last day", () => {
    expect(resetWeekDates("2026-10-10", 1)).toEqual({ from: "2026-10-10", to: "2026-10-16" });
    expect(resetWeekDates("2026-10-28", 1)).toEqual({ from: "2026-10-28", to: "2026-11-03" });
  });
});

describe("reminders", () => {
  it("formats times the way people say them", () => {
    expect(formatReminderTime("07:00")).toBe("7am");
    expect(formatReminderTime("12:00")).toBe("12pm");
    expect(formatReminderTime("19:30")).toBe("7:30pm");
  });

  it("skips today's time once it has passed and stops after week 12", () => {
    const now = new Date(2026, 9, 10, 9, 0);
    const r = upcomingResetReminders("2026-10-10", "07:00", now, 3);
    expect(r.map((x) => x.id)).toEqual(["reset-reminder-2026-10-11", "reset-reminder-2026-10-12"]);
    expect(r[0].title).toContain("week 1");
    expect(upcomingResetReminders("2026-07-01", "07:00", now, 3)).toEqual([]);
  });
});
