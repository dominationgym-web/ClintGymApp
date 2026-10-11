import { describe, expect, it } from "vitest";
import {
  RESET_HABITS,
  RESET_TRAINING,
  RESET_HOME_TRAINING,
  resetName,
  resetSetTarget,
  resetWeek,
  resetTraining,
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
    const names = [...Object.values(RESET_TRAINING), ...Object.values(RESET_HOME_TRAINING)].flatMap((t) =>
      t.sessions.flatMap((s) => s.exercises.flatMap((e) => [e.name, e.or ?? ""]))
    );
    expect(names.some((n) => /hack/i.test(n))).toBe(false);
  });
});

describe("home training", () => {
  it("has the same number of sessions as the gym plan in every phase", () => {
    for (const phase of ["calm", "rhythm", "build", "optimise"] as const) {
      expect(RESET_HOME_TRAINING[phase].sessions.length).toBe(RESET_TRAINING[phase].sessions.length);
      expect(resetTraining(phase, "home")).toBe(RESET_HOME_TRAINING[phase]);
      expect(resetTraining(phase, null)).toBe(RESET_TRAINING[phase]);
    }
  });

  it("only uses exercises the video lookup knows", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0051_reset_home_option.sql", "utf8");
    const names = [...Object.values(RESET_TRAINING), ...Object.values(RESET_HOME_TRAINING)].flatMap((t) =>
      t.sessions.flatMap((s) => s.exercises.flatMap((e) => (e.or ? [e.name, e.or] : [e.name])))
    );
    for (const n of names) expect(sql).toContain(`'${n}'`);
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

describe("resetSetTarget", () => {
  it("reads sets, reps and rest from every phase's sets line", () => {
    expect(resetSetTarget("2 sets of 10-12 reps, rest 1-2 minutes")).toEqual({ setsLabel: "2", sets: 2, reps: "10-12", restSeconds: 90 });
    expect(resetSetTarget("3-4 sets of 8-12 reps, rest 1-2 minutes")).toEqual({ setsLabel: "3-4", sets: 4, reps: "8-12", restSeconds: 90 });
    for (const t of Object.values(RESET_TRAINING)) expect(resetSetTarget(t.sets).reps).toMatch(/^\d+-\d+$/);
  });
});

describe("Men's Health Reset", () => {
  it("is named for men and women", () => {
    expect(resetName("male")).toBe("Men's Health Reset");
    expect(resetName("female")).toBe("Women's Health Reset");
    expect(resetName(null)).toBe("Women's Health Reset");
  });
  it("replaces the period week for men and keeps the rest", () => {
    expect(JSON.stringify(resetWeek(11, "male")).toLowerCase()).not.toMatch(/period|cycle|menstru/);
    expect(resetWeek(11, "female").todo.join(" ")).toContain("period");
    for (let w = 1; w <= 12; w++) {
      if (w !== 11) expect(resetWeek(w, "male")).toEqual(resetWeek(w, "female"));
      expect(resetWeek(w, "male").habits).toEqual(resetWeek(w, "female").habits);
    }
  });
  it("swaps hip abduction and adduction for lunges, gym and home", () => {
    for (const phase of ["calm", "rhythm", "build", "optimise"] as const) {
      for (const place of ["gym", "home"] as const) {
        const names = resetTraining(phase, place, "male").sessions.flatMap((s) => s.exercises.map((e) => e.name));
        expect(names.some((n) => /abduction|adduction/i.test(n))).toBe(false);
      }
    }
    const lower = resetTraining("optimise", "gym", "male").sessions[0].exercises.map((e) => e.name);
    expect(lower).toContain("Walking Lunge");
    expect(resetTraining("optimise", "gym", "female").sessions[0].exercises.map((e) => e.name)).toContain("Hip Abduction");
  });
});
