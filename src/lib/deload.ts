// Deload weeks (0115, GRIZZ, 2026-10-18): when a client has trained hard for
// weeks in a row, or is showing signs of fatigue, the trainer is told and can
// slot a deload week into the middle of their program with one tap. The same
// workouts, with half the sets at about 70% of the weight, then straight back
// onto the program the week after (deload_check / add_deload_week in SQL).
import { addDays } from "@/lib/programSchedule";
import { parseIsoDate } from "@/lib/dates";
import { weightStep, type Suggestion } from "@/lib/progression";
import type { ProgramExercise } from "@/types/database";

export const DELOAD_WEIGHT = 0.7;
export const DELOAD_BLUE = "#60A5FA";

/** Half the sets (rounded up) on strength exercises; cardio stays as it is. */
export function deloadExercises<T extends Pick<ProgramExercise, "sets" | "kind">>(rows: T[]): T[] {
  return rows.map((r) => (r.kind === "cardio" ? r : { ...r, sets: Math.max(1, Math.ceil(r.sets / 2)) }));
}

/** About 70% of the usual weight, rounded down to the exercise's weight step. */
export function deloadWeight(usual: number, exercise: { name: string; category: string | null }): number {
  const step = weightStep(exercise);
  const w = Math.floor((usual * DELOAD_WEIGHT) / step) * step;
  return Math.max(step, Math.round(w * 10) / 10);
}

/** Turns the usual "try this weight next" into the deload weight. */
export function deloadSuggestion(s: Suggestion | null, exercise: { name: string; category: string | null }): Suggestion | null {
  if (!s?.weight) return s;
  const top = s.last.match(/([\d.]+)kg/);
  const usual = top ? Number(top[1]) : s.weight;
  const w = deloadWeight(usual, exercise);
  return { last: s.last, advice: `Deload week: use about ${w}kg (70%) and stop 3 or more reps before failure.`, weight: w };
}

/** The next Monday after `today` (a deload week runs Monday to Sunday). */
export function nextMonday(today: string): string {
  const day = parseIsoDate(today).getDay();
  return addDays(today, day === 1 ? 7 : (8 - day) % 7 || 7);
}

/** Start choices for a deload week: next Monday, the Monday after, or tomorrow. */
export function deloadStartChoices(today: string): { date: string; label: string }[] {
  const mon = nextMonday(today);
  const label = (d: string) => `Mon ${Number(d.slice(8))} ${parseIsoDate(d).toLocaleDateString("en-ZA", { month: "short" })}`;
  const choices = [
    { date: mon, label: `${label(mon)} (next week)` },
    { date: addDays(mon, 7), label: `${label(addDays(mon, 7))} (week after)` },
  ];
  const tomorrow = addDays(today, 1);
  if (tomorrow !== mon) choices.push({ date: tomorrow, label: "Tomorrow" });
  return choices;
}
