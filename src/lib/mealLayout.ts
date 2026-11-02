import type { DietDay, DietItem, DietMeal } from "@/lib/dietPlan";
import { cleanTime, mealLabel } from "@/lib/mealPlanMaker";

// How many meals and snacks a day has, and when (GRIZZ, 2026-11-02: "some
// people only eat twice a day with maybe 1 snack... I think they should both
// be the same and adjustable"). The trainer's own diet planner uses the same
// picker as the Daily Evolution plan.

export type MealLayout = { meals: string[]; snacks: string[] };

/** The planner's first layout, the same as its old five slots: 3 meals and 2 snacks. */
export const DEFAULT_LAYOUT: MealLayout = { meals: ["07:00", "13:00", "19:00"], snacks: ["10:00", "15:30"] };

const isSnackName = (name: string) => /snack/i.test(name);
const timeOf = (name: string) => cleanTime(name.split("·")[0] ?? "");
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** The day's meals and snacks with their times; days from before times were set read as the default. */
export function dayLayout(day: DietDay): MealLayout {
  const meals: string[] = [];
  const snacks: string[] = [];
  for (const m of day.meals) {
    const t = timeOf(m.name);
    if (!t) return DEFAULT_LAYOUT;
    (isSnackName(m.name) ? snacks : meals).push(t);
  }
  return meals.length ? { meals, snacks } : DEFAULT_LAYOUT;
}

/**
 * The day laid out again with these meals and snacks, in time order. Foods
 * stay in the same meal or snack (first to first); foods from a meal or snack
 * that's gone move into the last one of its kind, or the last meal.
 */
export function relayoutDay(day: DietDay, layout: MealLayout): DietDay {
  const oldMeals = day.meals.filter((m) => !isSnackName(m.name));
  const oldSnacks = day.meals.filter((m) => isSnackName(m.name));
  const meals: DietMeal[] = layout.meals.map((t, i) => ({ name: mealLabel(t, "meal"), items: [...(oldMeals[i]?.items ?? [])] }));
  const snacks: DietMeal[] = layout.snacks.map((t, i) => ({ name: `${t} · Snack`, items: [...(oldSnacks[i]?.items ?? [])] }));
  const spill = (from: DietMeal[], kept: number, into: DietMeal[]) => {
    const extra: DietItem[] = from.slice(kept).flatMap((m) => m.items);
    const target = into[into.length - 1] ?? meals[meals.length - 1];
    if (extra.length && target) target.items.push(...extra);
  };
  spill(oldMeals, meals.length, meals);
  spill(oldSnacks, snacks.length, snacks);
  const all = [...meals, ...snacks].sort((a, b) => toMinutes(a.name.slice(0, 5)) - toMinutes(b.name.slice(0, 5)));
  return { meals: all };
}

/** Foods that would move because their meal or snack is going. */
export function foodsMoving(day: DietDay, layout: MealLayout): number {
  const oldMeals = day.meals.filter((m) => !isSnackName(m.name));
  const oldSnacks = day.meals.filter((m) => isSnackName(m.name));
  const count = (list: DietMeal[], kept: number) => list.slice(kept).reduce((n, m) => n + m.items.length, 0);
  return count(oldMeals, layout.meals.length) + count(oldSnacks, layout.snacks.length);
}
