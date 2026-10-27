import { sumTotals, type DietMeal } from "@/lib/dietPlan";
import type { ClientMealTick } from "@/types/database";

// Meal ticking (0163, GRIZZ 2026-10-27): the client ticks each meal off their
// plan as they eat it. A day's ticks all come from one plan day (the coach's
// plan, or their own training or rest day), so switching between them never
// counts a meal twice.

export type TickSource = ClientMealTick["source"];
export type MealTick = Pick<ClientMealTick, "ate_on" | "meal_key" | "source" | "meal_name" | "kcal" | "protein" | "carbs" | "fat">;
export type Eaten = { kcal: number; protein: number; carbs: number; fat: number };

/** Which meal of which plan day: its place and name, so a changed plan doesn't tick the wrong meal. */
export function mealKey(source: TickSource, index: number, name: string): string {
  return `${source}:${index}:${name}`.slice(0, 160);
}

/** The row to save when the client ticks this meal. */
export function tickFor(source: TickSource, index: number, meal: DietMeal, day: string): MealTick {
  const t = sumTotals(meal.items);
  return {
    ate_on: day,
    meal_key: mealKey(source, index, meal.name),
    source,
    meal_name: meal.name.slice(0, 120) || "Meal",
    kcal: Math.min(10000, Math.round(t.kcal)),
    protein: Math.round(t.protein * 10) / 10,
    carbs: Math.round(t.carbs * 10) / 10,
    fat: Math.round(t.fat * 10) / 10,
  };
}

/** Ticks from another plan day on the same date: these come off when this one is ticked. */
export function otherSourceTicks(ticks: MealTick[], day: string, source: TickSource): MealTick[] {
  return ticks.filter((t) => t.ate_on === day && t.source !== source);
}

/** What the client ate on `day`, from their ticks. */
export function eatenOn(ticks: MealTick[], day: string): Eaten {
  return ticks
    .filter((t) => t.ate_on === day)
    .reduce(
      (a, t) => ({ kcal: a.kcal + t.kcal, protein: a.protein + Number(t.protein), carbs: a.carbs + Number(t.carbs), fat: a.fat + Number(t.fat) }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

/** The plan day today's ticks came from, if any. */
export function tickedSource(ticks: MealTick[], day: string): TickSource | null {
  return ticks.find((t) => t.ate_on === day)?.source ?? null;
}

/**
 * A short, plain tip from the week's ticks: protein short on most ticked days,
 * or meals going unticked. Null when there's nothing to say.
 */
export function weekFoodTip(ticks: MealTick[], days: string[], targets: { kcal: number; protein: number } | null, today: string): string | null {
  const ticked = days.filter((d) => d <= today && ticks.some((t) => t.ate_on === d));
  if (!ticked.length) return null;
  // Today isn't over yet, so it doesn't count as short.
  const done = ticked.filter((d) => d < today);
  if (targets && done.length >= 2) {
    const shortProtein = done.filter((d) => eatenOn(ticks, d).protein < targets.protein * 0.85);
    if (shortProtein.length * 2 > done.length) {
      return `Protein was short on ${shortProtein.length} of ${done.length} days. Tick each meal as you eat it, and if you skip one, add a protein snack later in the day.`;
    }
    const onTarget = done.filter((d) => Math.abs(eatenOn(ticks, d).kcal - targets.kcal) <= 200);
    if (onTarget.length === done.length) return `Every ticked day was within 200 kcal of your target. Keep it going!`;
  }
  const past = days.filter((d) => d < today);
  const missed = past.filter((d) => !ticks.some((t) => t.ate_on === d));
  if (missed.length >= 2) return `${missed.length} days this week have no meals ticked. Tick each meal as you eat it, so you and your coach can see how the week really went.`;
  return null;
}
