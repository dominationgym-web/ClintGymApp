import type { TrainerTimeOff } from "@/types/database";

// Coach holidays (0205): whole days, first and last day as "2026-12-14".
// Shown on the clients' apps (Today, My sessions, training calendar).

export type Holiday = Pick<TrainerTimeOff, "id" | "reason"> & Partial<Pick<TrainerTimeOff, "missed">> & { holiday_from: string; holiday_until: string };

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 14 Dec" for "2026-12-14". */
export function holidayDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const x = new Date(y, m - 1, d, 12);
  return `${SHORT_DAYS[x.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** "on Mon 14 Dec" / "from Mon 14 Dec to Sun 20 Dec" / "until Sun 20 Dec" (already started). */
export function holidaySpan(h: Pick<Holiday, "holiday_from" | "holiday_until">, today?: string): string {
  if (today && h.holiday_from <= today && h.holiday_until > today) return `until ${holidayDay(h.holiday_until)}`;
  if (h.holiday_from === h.holiday_until) return `on ${holidayDay(h.holiday_from)}`;
  return `from ${holidayDay(h.holiday_from)} to ${holidayDay(h.holiday_until)}`;
}

/** Holidays not over yet, soonest first. */
export function upcomingHolidays<T extends Pick<Holiday, "holiday_from" | "holiday_until">>(list: T[], today: string): T[] {
  return list.filter((h) => h.holiday_until >= today).sort((a, b) => a.holiday_from.localeCompare(b.holiday_from));
}

/** The holiday on that day, if any. */
export function holidayOn<T extends Pick<Holiday, "holiday_from" | "holiday_until">>(list: T[], day: string): T | null {
  return list.find((h) => day >= h.holiday_from && day <= h.holiday_until) ?? null;
}

/** Number of days, first and last included. */
export function holidayLength(from: string, until: string): number {
  const [a, b] = [from, until].map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000) + 1;
}

/** Only rows that are holidays (other blocked-out time isn't). */
export function asHolidays(rows: TrainerTimeOff[]): Holiday[] {
  return rows.filter((r): r is TrainerTimeOff & Holiday => !!r.holiday_from && !!r.holiday_until && !r.removed_at);
}
