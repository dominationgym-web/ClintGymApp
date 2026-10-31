import type { Checkin } from "@/types/database";
import { SLEEP_TARGET_HOURS, sleepHours, waterTargetLitres } from "@/lib/checkinFeedback";
import type { Better, Point } from "@/lib/progress";

// Check-in habits month by month (GRIZZ, 2026-10-31: "end of each month remind
// them of how often they drank alcohol. How often they got their water intake
// in etc. Have this in their progress section so they can see if it's
// increasing or decreasing"). Counts are days out of the days they checked in.

export type MonthlyRow = Pick<
  Checkin,
  | "checkin_date"
  | "alcohol_units"
  | "water_litres"
  | "sleep_bed_time"
  | "sleep_asleep_time"
  | "sleep_wake_time"
  | "sleep_quality"
  | "high_gi_count"
  | "wound_down"
  | "pain_status"
  | "fatigue_status"
  | "mental_status"
>;

export type HabitKey =
  | "checkins"
  | "alcoholDays"
  | "alcoholUnits"
  | "waterDays"
  | "sleepHours"
  | "sleepQuality"
  | "tiredDays"
  | "painDays"
  | "moodDays"
  | "highGi"
  | "woundDown";

export type Habit = { key: HabitKey; label: string; icon: string; unit: string; better: Better };

// In the order they're shown.
export const HABITS: Habit[] = [
  { key: "checkins", label: "Check-ins", icon: "📋", unit: "days", better: "up" },
  { key: "alcoholDays", label: "Days with alcohol", icon: "🍷", unit: "days", better: "down" },
  { key: "alcoholUnits", label: "Alcohol units", icon: "🍺", unit: "units", better: "down" },
  { key: "waterDays", label: "Water target hit", icon: "💧", unit: "days", better: "up" },
  { key: "sleepHours", label: "Average sleep", icon: "😴", unit: "h", better: "up" },
  { key: "sleepQuality", label: "Sleep quality", icon: "🌙", unit: "/ 5", better: "up" },
  { key: "tiredDays", label: "Tired or low energy", icon: "🔋", unit: "days", better: "down" },
  { key: "painDays", label: "Pain or injury", icon: "🩹", unit: "days", better: "down" },
  { key: "moodDays", label: "Low mood or stress", icon: "🧠", unit: "days", better: "down" },
  { key: "highGi", label: "High-GI meals", icon: "🍩", unit: "meals", better: "down" },
  { key: "woundDown", label: "Wound down without screens", icon: "📵", unit: "days", better: "up" },
];

export type MonthStats = { month: string; values: Record<HabitKey, number | null> };

const round1 = (n: number) => Math.round(n * 10) / 10;
const monthOf = (date: string) => `${date.slice(0, 7)}-01`;

/** One month's numbers from its check-ins. Averages are null when nothing was answered. */
export function monthStats(month: string, rows: MonthlyRow[], weightKg?: number | null): MonthStats {
  const target = waterTargetLitres(weightKg);
  const sleeps = rows.map((r) => sleepHours(r.sleep_asleep_time ?? r.sleep_bed_time, r.sleep_wake_time)).filter((h): h is number => h !== null);
  const quality = rows.map((r) => r.sleep_quality).filter((q): q is NonNullable<typeof q> => q != null);
  const count = (f: (r: MonthlyRow) => boolean) => rows.filter(f).length;
  const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    month,
    values: {
      checkins: rows.length,
      alcoholDays: count((r) => Number(r.alcohol_units) > 0),
      alcoholUnits: round1(rows.reduce((a, r) => a + (Number(r.alcohol_units) || 0), 0)),
      waterDays: count((r) => Number(r.water_litres) >= target),
      sleepHours: avg(sleeps),
      sleepQuality: avg(quality),
      tiredDays: count((r) => r.fatigue_status === "reported"),
      painDays: count((r) => r.pain_status === "reported"),
      moodDays: count((r) => r.mental_status === "reported"),
      highGi: rows.reduce((a, r) => a + (Number(r.high_gi_count) || 0), 0),
      woundDown: count((r) => r.wound_down === true),
    },
  };
}

/** Every month with a check-in, oldest first. */
export function monthlyStats(rows: MonthlyRow[], weightKg?: number | null): MonthStats[] {
  const byMonth = new Map<string, MonthlyRow[]>();
  for (const r of rows) {
    const m = monthOf(r.checkin_date);
    byMonth.set(m, [...(byMonth.get(m) ?? []), r]);
  }
  return [...byMonth.keys()].sort().map((m) => monthStats(m, byMonth.get(m)!, weightKg));
}

export type HabitChange = { habit: Habit; now: number | null; before: number | null; change: number | null; trend: "better" | "worse" | "same" | null };

/** Each habit this month against the month before. */
export function compareMonths(now: MonthStats, before: MonthStats | null): HabitChange[] {
  return HABITS.map((habit) => {
    const a = now.values[habit.key];
    const b = before?.values[habit.key] ?? null;
    if (a === null || b === null) return { habit, now: a, before: b, change: null, trend: null };
    const change = round1(a - b);
    const trend = change === 0 ? "same" : (change > 0) === (habit.better === "up") ? "better" : "worse";
    return { habit, now: a, before: b, change, trend };
  });
}

/** One habit as graph points, one per month. */
export function habitSeries(months: MonthStats[], key: HabitKey): Point[] {
  return months.filter((m) => m.values[key] !== null).map((m) => ({ date: m.month, value: m.values[key]! }));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** How a number reads: "6 of 22 days", "6.8 h", "14 units". */
export function habitValue(h: Habit, value: number | null, checkins: number): string {
  if (value === null) return "-";
  if (h.key === "checkins") return `${value} day${value === 1 ? "" : "s"}`;
  if (h.unit === "days") return `${value} of ${checkins} days`;
  if (h.key === "sleepQuality") return `${value} / 5`;
  if (h.key === "sleepHours") return `${value} h${value >= SLEEP_TARGET_HOURS ? "" : ` (aim ${SLEEP_TARGET_HOURS})`}`;
  return `${value} ${h.unit}`;
}
