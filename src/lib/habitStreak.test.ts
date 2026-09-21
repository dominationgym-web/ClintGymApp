import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateHabitTier, DAYS_PER_TIER, STREAK_TIERS } from "@/lib/habitStreak";
import type { Habit } from "@/types/database";

// "Today" is frozen to Monday 21 September 2026 so the fixtures below can use
// real dates and never drift or straddle midnight.
const TODAY = "2026-09-21";
const MONDAY = 1;

const originalTz = process.env.TZ;

// The streak used to be computed with `toISOString()`, which converts to UTC
// first and so returned the previous calendar day in any timezone ahead of
// UTC. The clients are in South Africa (UTC+2), so that ran the whole streak a
// day behind. Every case runs in a UTC+ timezone as well as UTC to keep that
// from coming back.
const TIMEZONES = ["UTC", "Africa/Johannesburg", "Pacific/Kiritimati"];

afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = originalTz;
});

function freeze(tz: string) {
  process.env.TZ = tz;
  vi.useFakeTimers();
  // Mid-morning local time: a client's habit is normally logged during the day.
  vi.setSystemTime(new Date(2026, 8, 21, 10, 30, 0));
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    client_id: "c1",
    name: "Drink 3l of water",
    active_days: [0, 1, 2, 3, 4, 5, 6],
    reps_target: 1,
    start_date: TODAY,
    end_date: null,
    reminder_enabled: false,
    reminder_time: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Completed logs for every calendar day from `from` to `to` inclusive. */
function completed(from: string, to: string): Record<string, number> {
  const logs: Record<string, number> = {};
  for (const d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    logs[d.toISOString().slice(0, 10)] = 1;
  }
  return logs;
}

describe("calculateHabitTier", () => {
  // This is the case that was broken in production for South African clients.
  it.each(TIMEZONES)("counts a habit completed today, in %s", (tz) => {
    freeze(tz);
    expect(calculateHabitTier(habit(), completed(TODAY, TODAY))).toMatchObject({ tier: 0, progress: 1 });
  });

  it.each(TIMEZONES)("earns the next tier after 7 completed days, in %s", (tz) => {
    freeze(tz);
    const h = habit({ start_date: "2026-09-14" });
    // 14th to 20th is seven days; today is still in progress.
    expect(calculateHabitTier(h, completed("2026-09-14", "2026-09-20"))).toMatchObject({ tier: 1, progress: 0 });
  });

  it.each(TIMEZONES)("does not judge today until it is done, in %s", (tz) => {
    freeze(tz);
    const h = habit({ start_date: "2026-09-14" });
    const withoutToday = calculateHabitTier(h, completed("2026-09-14", "2026-09-20"));
    // An untouched today must not read as a miss and cost a tier.
    expect(withoutToday.tier).toBe(1);
  });

  it.each(TIMEZONES)("drops one tier per missed scheduled day, in %s", (tz) => {
    freeze(tz);
    const h = habit({ start_date: "2026-09-01" });
    // 1st to 14th earns two tiers; 15th and 16th missed; 17th to 20th completed.
    const logs = { ...completed("2026-09-01", "2026-09-14"), ...completed("2026-09-17", "2026-09-20") };
    const result = calculateHabitTier(h, logs);
    expect(result.tier).toBe(0);
    expect(result.progress).toBe(4);
  });

  it.each(TIMEZONES)("only counts scheduled days, in %s", (tz) => {
    freeze(tz);
    // Mondays only: the 7th, 14th and 21st. The 21st is today and untouched.
    const h = habit({ start_date: "2026-09-01", active_days: [MONDAY] });
    const result = calculateHabitTier(h, completed("2026-09-07", "2026-09-14"));
    expect(result).toMatchObject({ tier: 0, progress: 2 });
  });

  it.each(TIMEZONES)("does not punish unscheduled days that were skipped, in %s", (tz) => {
    freeze(tz);
    const h = habit({ start_date: "2026-09-01", active_days: [MONDAY] });
    // Nothing logged at all, but only two scheduled days have passed.
    expect(calculateHabitTier(h, {})).toMatchObject({ tier: 0, progress: 0 });
  });

  it.each(TIMEZONES)("stops counting after the habit's end date, in %s", (tz) => {
    freeze(tz);
    const h = habit({ start_date: "2026-09-01", end_date: "2026-09-07" });
    // Logs after the end date must not add progress: seven days, not twenty.
    const result = calculateHabitTier(h, completed("2026-09-01", "2026-09-20"));
    expect(result).toMatchObject({ tier: 1, progress: 0 });
  });

  it.each(TIMEZONES)("needs the full reps target to count a day, in %s", (tz) => {
    freeze(tz);
    const h = habit({ start_date: TODAY, reps_target: 3 });
    expect(calculateHabitTier(h, { [TODAY]: 2 }).progress).toBe(0);
    expect(calculateHabitTier(h, { [TODAY]: 3 }).progress).toBe(1);
    expect(calculateHabitTier(h, { [TODAY]: 4 }).progress).toBe(1);
  });

  it("starts a brand new habit at the first tier with no progress", () => {
    freeze("Africa/Johannesburg");
    expect(calculateHabitTier(habit(), {})).toMatchObject({ tier: 0, progress: 0 });
  });

  it("reaches the green goal tier and stays there", () => {
    freeze("Africa/Johannesburg");
    // Four tiers to earn at 7 days each, so 28 completed days gets to green.
    const h = habit({ start_date: "2026-08-01" });
    const result = calculateHabitTier(h, completed("2026-08-01", "2026-09-20"));
    expect(result.tier).toBe(STREAK_TIERS.length - 1);
    expect(result.label).toBe("Green - goal achieved");
  });

  it("returns the colour and label of the tier it lands on", () => {
    freeze("Africa/Johannesburg");
    const h = habit({ start_date: "2026-09-14" });
    const result = calculateHabitTier(h, completed("2026-09-14", "2026-09-20"));
    expect(result.color).toBe(STREAK_TIERS[1].color);
    expect(result.label).toBe(STREAK_TIERS[1].label);
  });

  it("takes exactly DAYS_PER_TIER days to move up a tier", () => {
    freeze("Africa/Johannesburg");
    // 15th to 20th is six days, one short, with today still in progress.
    const oneShort = calculateHabitTier(habit({ start_date: "2026-09-15" }), completed("2026-09-15", "2026-09-20"));
    expect(oneShort).toMatchObject({ tier: 0, progress: DAYS_PER_TIER - 1 });

    // Add the 14th and the seventh day earns the tier.
    const exact = calculateHabitTier(habit({ start_date: "2026-09-14" }), completed("2026-09-14", "2026-09-20"));
    expect(exact).toMatchObject({ tier: 1, progress: 0 });
  });
});
