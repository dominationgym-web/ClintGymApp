import { dayKey, sessionKind } from "@/lib/liveSessions";
import type { LiveSession, SessionKind } from "@/types/database";

// What the trainer made from 1 on 1 sessions, day by day and week by week
// (GRIZZ, 2026-11-01: "at the end of every day the app shows what the trainer
// made on that day after all cancellations and forfeits ... as well as an end
// of the week financial breakdown"). Same rules as the month-end invoice:
// trained, unmarked (counts as done), late cancellations, no-shows and
// in-time cancellations kept for a catch-up are paid; in-time cancellations,
// credited no-shows and the coach's own cancellations are not.

type EarningFields = Pick<LiveSession, "status" | "starts_at" | "minutes" | "charge" | "cancelled_by" | "fee">;

const PAID: SessionKind[] = ["done", "unconfirmed", "late", "no_show", "makeup"];
const CREDITED: SessionKind[] = ["notice", "excused"];

export type Takings = {
  /** Money made: trained plus charged cancellations and no-shows. */
  made: number;
  /** Of that, from late cancellations and no-shows. */
  fromCancellations: number;
  /** Sessions that were not charged (in time, credited, coach cancelled). */
  credited: number;
  /** Sessions the coach cancelled or blocked out (0177): not charged. */
  byCoach: number;
  byCoachCount: number;
  /** Cancellations still waiting for "charge or credit?". */
  undecided: number;
  /** Booked and not happened yet. */
  toCome: number;
  trained: number;
  charged: number;
  creditedCount: number;
  undecidedCount: number;
  toComeCount: number;
};

const empty = (): Takings => ({
  made: 0,
  fromCancellations: 0,
  credited: 0,
  byCoach: 0,
  byCoachCount: 0,
  undecided: 0,
  toCome: 0,
  trained: 0,
  charged: 0,
  creditedCount: 0,
  undecidedCount: 0,
  toComeCount: 0,
});

export function takings(sessions: EarningFields[], now: Date = new Date()): Takings {
  const t = empty();
  for (const s of sessions) {
    const kind = sessionKind(s, now);
    const fee = Number(s.fee) || 0;
    if (PAID.includes(kind)) {
      t.made += fee;
      if (kind === "done" || kind === "unconfirmed") t.trained += 1;
      else {
        t.fromCancellations += fee;
        t.charged += 1;
      }
    } else if (CREDITED.includes(kind)) {
      t.credited += fee;
      t.creditedCount += 1;
    } else if (kind === "trainer") {
      t.byCoach += fee;
      t.byCoachCount += 1;
    } else if (kind === "decide") {
      t.undecided += fee;
      t.undecidedCount += 1;
    } else if (kind === "booked") {
      t.toCome += fee;
      t.toComeCount += 1;
    }
  }
  return t;
}

/** Monday of the week the day is in, as a day key. */
export function weekStart(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayKey(x);
}

/** The seven day keys of a week, Monday first. */
export function weekDays(monday: string): string[] {
  const [y, m, d] = monday.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(y, m - 1, d + i)));
}

export function shiftWeek(monday: string, by: number): string {
  const [y, m, d] = monday.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + 7 * by));
}

/** "Mon 2 Nov – Sun 8 Nov". */
export function weekLabel(monday: string): string {
  const days = weekDays(monday);
  const fmt = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    const x = new Date(y, m - 1, d);
    return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()]} ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
  };
  return `${fmt(days[0])} – ${fmt(days[6])}`;
}

export type DayTakings = { day: string; takings: Takings; sessions: number };

/** Each day of the week with its takings, plus the week's total. */
export function weekTakings<T extends EarningFields>(
  sessions: T[],
  monday: string,
  now: Date = new Date()
): { days: DayTakings[]; total: Takings } {
  const days = weekDays(monday);
  const inWeek = sessions.filter((s) => s.status !== "removed" && days.includes(dayKey(s.starts_at)));
  return {
    days: days.map((day) => {
      const list = inWeek.filter((s) => dayKey(s.starts_at) === day);
      return { day, takings: takings(list, now), sessions: list.length };
    }),
    total: takings(inWeek, now),
  };
}

/** Takings per person for the week, biggest first. */
export function takingsByPerson<T extends EarningFields>(sessions: T[], who: (s: T) => string, now: Date = new Date()) {
  const groups = new Map<string, T[]>();
  for (const s of sessions) {
    if (s.status === "removed") continue;
    const name = who(s);
    groups.set(name, [...(groups.get(name) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([name, list]) => ({ name, takings: takings(list, now) }))
    .sort((a, b) => b.takings.made - a.takings.made || a.name.localeCompare(b.name));
}

// Predicted income (GRIZZ, 2026-11-01: "as a motivation I would like a
// predicted weekly and monthly income. As well as predicted vs actual at the
// end of the week"). Predicted is everything that was on the calendar: each
// session's fee whatever happened to it, so cancellations and no-shows show
// as the gap between predicted and actual. Left out: catch-ups (they replace
// a session already counted) and sessions taken off the calendar before their
// time (moved or booked by mistake). One taken off after its time (a person
// not in the app who didn't come) still counts as predicted.
type PredictFields = EarningFields & Pick<LiveSession, "makeup_for" | "updated_at">;

export function predicted(sessions: PredictFields[]): number {
  let total = 0;
  for (const s of sessions) {
    if (s.makeup_for) continue;
    if (s.status === "removed" && new Date(s.updated_at).getTime() < new Date(s.starts_at).getTime()) continue;
    total += Number(s.fee) || 0;
  }
  return total;
}

export type Forecast = {
  predicted: number;
  made: number;
  toCome: number;
  /**
   * The countdown (GRIZZ: "drops as clients cancel or trainer cancels like a
   * countdown clock"): made + still to come + cancellations not decided yet.
   * Starts at predicted and only goes down.
   */
  heading: number;
  finished: boolean;
};

function forecast(sessions: PredictFields[], inRange: (day: string) => boolean, lastDay: string, now: Date): Forecast {
  const list = sessions.filter((s) => inRange(dayKey(s.starts_at)));
  const t = takings(list.filter((s) => s.status !== "removed"), now);
  return { predicted: predicted(list), made: t.made, toCome: t.toCome, heading: t.made + t.toCome + t.undecided, finished: dayKey(now) > lastDay };
}

/** The week from Monday: predicted, made so far, still to come. */
export function weekForecast(sessions: PredictFields[], monday: string, now: Date = new Date()): Forecast {
  const days = new Set(weekDays(monday));
  return forecast(sessions, (d) => days.has(d), weekDays(monday)[6], now);
}

/** The calendar month the day is in. */
export function monthForecast(sessions: PredictFields[], now: Date = new Date()): Forecast {
  const prefix = dayKey(now).slice(0, 8);
  const last = dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return forecast(sessions, (d) => d.startsWith(prefix), last, now);
}

/** "92%" of predicted made (0 when nothing was predicted). */
export function percentOf(made: number, predictedTotal: number): number {
  return predictedTotal > 0 ? Math.round((made / predictedTotal) * 100) : 0;
}
