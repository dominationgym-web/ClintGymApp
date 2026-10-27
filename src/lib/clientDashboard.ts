import { liftKey, MAIN_LIFTS, type LiftLog } from "@/lib/progress";

// The client's laptop view (GRIZZ, 2026-10-27): the sums behind My week and
// Weights lifted, worked out from the training log. Warm-up sets never count.

export type DashLog = LiftLog & { set_number: number };

const working = (l: LiftLog) => !l.warm_up;
const inRange = (l: LiftLog, from: string, to: string) => l.log_date >= from && l.log_date <= to;

/** Kilograms lifted (weight × reps of every working set) from `from` to `to`, optionally for one lift. */
export function liftedKg(logs: LiftLog[], from: string, to: string, key?: string): number {
  let sum = 0;
  for (const l of logs) {
    if (!working(l) || !inRange(l, from, to) || (key && liftKey(l.exercise_name) !== key)) continue;
    sum += (l.weight_kg ?? 0) * l.reps;
  }
  return Math.round(sum);
}

/** The exercises done on each day, in the order first logged. */
export function exercisesByDay(logs: LiftLog[], days: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>(days.map((d) => [d, []]));
  for (const l of logs) {
    const list = map.get(l.log_date);
    const name = l.exercise_name.trim();
    if (list && !list.includes(name)) list.push(name);
  }
  return map;
}

/** "Bench press, Squat +3 more". */
export function exercisesLabel(names: string[], show = 2): string {
  if (!names.length) return "";
  const more = names.length - show;
  return names.slice(0, show).join(", ") + (more > 0 ? ` +${more} more` : "");
}

export type BestSet = { kg: number; reps: number; date: string; name: string };

/** Estimated one-rep max (Epley), to the nearest kg; the weight itself for a single. */
export function oneRepMax(kg: number, reps: number): number {
  return reps <= 1 ? kg : Math.round(kg * (1 + reps / 30));
}

const heavier = (a: BestSet, kg: number, reps: number) => kg > a.kg || (kg === a.kg && reps > a.reps);

/** The heaviest working set of a lift (most reps at that weight), optionally only before `before`. */
export function bestSet(logs: LiftLog[], key: string, before?: string): BestSet | null {
  let best: BestSet | null = null;
  for (const l of logs) {
    const kg = l.weight_kg ?? 0;
    if (!working(l) || kg <= 0 || liftKey(l.exercise_name) !== key || (before && l.log_date >= before)) continue;
    if (!best || heavier(best, kg, l.reps)) best = { kg, reps: l.reps, date: l.log_date, name: l.exercise_name.trim() };
  }
  return best;
}

export type NewBest = BestSet & { was: BestSet };

/** Lifts where a set from `from` on beat everything before it, biggest jump first. */
export function newBests(logs: LiftLog[], from: string): NewBest[] {
  const keys = new Set(logs.filter((l) => l.log_date >= from && working(l)).map((l) => liftKey(l.exercise_name)));
  const out: NewBest[] = [];
  for (const key of keys) {
    const was = bestSet(logs, key, from);
    const now = bestSet(logs.filter((l) => l.log_date >= from), key);
    if (was && now && heavier(was, now.kg, now.reps)) out.push({ ...now, name: liftName(key, now.name), was });
  }
  return out.sort((a, b) => b.kg - b.was.kg - (a.kg - a.was.kg));
}

/** The main lift's name ("Deadlift"), or the exercise's own. */
export function liftName(key: string, fallback: string): string {
  return MAIN_LIFTS.find((m) => m.key === key)?.label ?? fallback;
}

/** The sets of a lift on the last day it was done, in order. */
export function lastSession(logs: DashLog[], key: string): { date: string; sets: DashLog[] } | null {
  const mine = logs.filter((l) => liftKey(l.exercise_name) === key);
  if (!mine.length) return null;
  const date = mine.reduce((d, l) => (l.log_date > d ? l.log_date : d), mine[0].log_date);
  const sets = mine
    .filter((l) => l.log_date === date)
    .sort((a, b) => Number(!a.warm_up) - Number(!b.warm_up) || a.set_number - b.set_number);
  return { date, sets };
}

/** Every exercise's best set, heaviest first: the Records page. Body-weight-only exercises are left out. */
export function records(logs: LiftLog[]): (BestSet & { key: string; oneRm: number })[] {
  const keys = new Set(logs.map((l) => liftKey(l.exercise_name)));
  const out: (BestSet & { key: string; oneRm: number })[] = [];
  for (const key of keys) {
    const best = bestSet(logs, key);
    if (best) out.push({ ...best, key, name: liftName(key, best.name), oneRm: oneRepMax(best.kg, best.reps) });
  }
  return out.sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
}

/** First day of the month `iso` is in, and of the month before. */
export function monthStarts(iso: string): { thisMonth: string; lastMonth: string; lastMonthEnd: string } {
  const [y, m] = iso.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const lastDay = new Date(y, m - 1, 0).getDate();
  return { thisMonth: `${y}-${pad(m)}-01`, lastMonth: `${prevY}-${pad(prevM)}-01`, lastMonthEnd: `${prevY}-${pad(prevM)}-${pad(lastDay)}` };
}

/** Percent change from `before` to `now`, rounded; null when there's nothing before. */
export function pctChange(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

/** "18 450": thousands with a space, South African style. */
export function grouped(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Kilograms a week, from the first to the last point, to one decimal; null with under 2 weeks between them. */
export function perWeek(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  const days = (Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${a.date}T00:00:00Z`)) / 86400000;
  if (days < 14) return null;
  return Math.round(((b.value - a.value) / days) * 7 * 10) / 10;
}
