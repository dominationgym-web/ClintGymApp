import { findFood, type DietDay } from "@/lib/dietPlan";
import { makeDay, type MacroTargets, type MealPlanSettings } from "@/lib/mealPlanMaker";
import { parseIsoDate, toIsoDate } from "@/lib/dates";

// A week of meals at a time (GRIZZ, 2026-11-02: "the option to work out diet
// for a week at a time"): a different plan for each day, Monday to Sunday,
// with training-day carbs on the days they train. Each new week is made again
// from the client's tastes, which the app learns from what they swap in, leave
// out and put in their own meals ("get a feel for what they like and make
// changes over time accordingly").

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEK_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** The week's plan: the Monday it starts on, and one day for each weekday. */
export type MealWeek = { startsOn: string; days: DietDay[] };

/**
 * What the client likes and doesn't, as scores per food, plus the foods the
 * plan favours now and the AI's note about their tastes for the trainer.
 */
export type Taste = {
  liked: Record<string, number>;
  disliked: Record<string, number>;
  /** When the plan was last adapted to their tastes (YYYY-MM-DD). */
  adaptedOn?: string;
  /** A short note on what they like, from the AI (or the app's own reading). */
  note?: string;
};

export const EMPTY_TASTE: Taste = { liked: {}, disliked: {} };

/** The Monday of the week `iso` is in. */
export function weekStart(iso: string): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIsoDate(d);
}

/** Which weekday `iso` is: 0 = Monday ... 6 = Sunday. */
export function weekdayOf(iso: string): number {
  return (parseIsoDate(iso).getDay() + 6) % 7;
}

/** Whether they train on this weekday (0 = Monday), on a weekly plan. */
export function trainsOn(settings: MealPlanSettings, day: number): boolean {
  if (!settings.training) return false;
  return (settings.trainDays ?? []).includes(day);
}

/** Their training days from the intake (1 = Monday ... 7 = Sunday) as 0-6, or a guess. */
export function defaultTrainDays(intakeDays: number[], perWeek?: number | null): number[] {
  if (intakeDays.length) return intakeDays.map((d) => d - 1);
  const n = Math.max(0, Math.min(7, perWeek ?? 3));
  return [[], [0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]][n];
}

/** Seven days of meals, each with different foods. */
export function makeWeek(settings: MealPlanSettings, targets: MacroTargets, variety: number, startsOn: string): MealWeek {
  const days = WEEK_DAYS.map((_, i) => makeDay(settings, targets, trainsOn(settings, i), variety * 7 + i));
  return { startsOn, days };
}

/** A weekly plan from before this week: time for next week's plan. */
export function weekIsOld(week: MealWeek | null | undefined, today: string): boolean {
  return !!week?.startsOn && week.startsOn < weekStart(today);
}

/** A saved week, if it really is one. */
export function readWeek(value: unknown): MealWeek | null {
  const w = value as Partial<MealWeek> | null;
  if (!w || typeof w.startsOn !== "string" || !Array.isArray(w.days) || w.days.length !== 7) return null;
  return { startsOn: w.startsOn, days: w.days as DietDay[] };
}

/** A saved taste, filled in. */
export function readTaste(value: unknown): Taste {
  const t = (value ?? {}) as Partial<Taste>;
  return { ...t, liked: { ...(t.liked ?? {}) }, disliked: { ...(t.disliked ?? {}) } };
}

// Scores stay small: the most recent choices count, and the list never grows past this.
const MAX_FOODS = 60;

function bump(scores: Record<string, number>, food: string, by: number): Record<string, number> {
  const next = { ...scores, [food]: Math.max(0, (scores[food] ?? 0) + by) };
  if (!next[food]) delete next[food];
  const names = Object.keys(next);
  if (names.length <= MAX_FOODS) return next;
  // Drop the weakest.
  const keep = names.sort((a, b) => next[b] - next[a]).slice(0, MAX_FOODS);
  return Object.fromEntries(keep.map((k) => [k, next[k]]));
}

/** They swapped `from` for `to`: they like `to` more. */
export function tasteSwap(taste: Taste, from: string, to: string): Taste {
  return { ...taste, disliked: bump(taste.disliked, from, 1), liked: bump(bump(taste.liked, to, 1), from, -1) };
}

/** They left `food` out: a strong sign they don't like it. */
export function tasteLeaveOut(taste: Taste, food: string): Taste {
  const liked = { ...taste.liked };
  delete liked[food];
  return { ...taste, liked, disliked: bump(taste.disliked, food, 2) };
}

/** They put a food back that they had left out. */
export function tastePutBack(taste: Taste, food: string): Taste {
  const disliked = { ...taste.disliked };
  delete disliked[food];
  return { ...taste, disliked, liked: bump(taste.liked, food, 1) };
}

/** The foods they put in their own meal: they eat these every day. */
export function tasteOwnMeal(taste: Taste, foods: string[]): Taste {
  let liked = taste.liked;
  for (const f of new Set(foods)) liked = bump(liked, f, 2);
  return { ...taste, liked };
}

/**
 * The foods the app favours when the AI isn't there: ones they chose at
 * least twice more than they pushed away, best first, at most 12.
 */
export function learnedLikes(taste: Taste): string[] {
  return Object.entries(taste.liked)
    .map(([food, n]) => [food, n - (taste.disliked[food] ?? 0)] as const)
    .filter(([food, n]) => n >= 2 && !!findFood(food))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([food]) => food);
}

/** Foods they've pushed away at least twice and never chose: the app leaves these out. */
export function learnedDislikes(taste: Taste): string[] {
  return Object.entries(taste.disliked)
    .filter(([food, n]) => n >= 2 && !(taste.liked[food] > 0))
    .map(([food]) => food);
}

/** The app's own short note on their tastes, when the AI isn't there. */
export function tasteNote(taste: Taste, firstName: string): string {
  const likes = learnedLikes(taste).slice(0, 4);
  const dislikes = learnedDislikes(taste).slice(0, 4);
  if (!likes.length && !dislikes.length) return `Not much to go on yet. As ${firstName} swaps foods, the plan learns what they like.`;
  const parts: string[] = [];
  if (likes.length) parts.push(`${firstName} often picks ${listOf(likes)}, so these come up more`);
  if (dislikes.length) parts.push(`${listOf(dislikes)} ${dislikes.length === 1 ? "stays" : "stay"} out`);
  return `${parts.join("; ")}.`;
}

function listOf(foods: string[]): string {
  const names = foods.map((f) => f.replace(/\s*\([^)]*\)$/, "").toLowerCase());
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
