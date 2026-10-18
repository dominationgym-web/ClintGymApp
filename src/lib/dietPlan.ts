import { FOODS, type Food, type FoodGroup } from "@/lib/foods";
import type { ClientDietPlan, DietDay, DietItem, DietMeal } from "@/types/database";

export type { DietDay, DietItem, DietMeal };

// Trainer's diet planner (0071, GRIZZ 2026-10-12): the trainer builds a
// client's week meal by meal. They pick a food, say how much protein, carbs,
// fat or fibre the meal should get from it, and the app works out the weight.
// Each day is checked against the client's calorie target.

export type DietSex = "male" | "female";
export type DietPlan = ClientDietPlan;

export const DIET_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEAL_NAMES = ["Breakfast", "Morning snack", "Lunch", "Afternoon snack", "Dinner"];

export function emptyDay(): DietDay {
  return { meals: MEAL_NAMES.map((name) => ({ name, items: [] })) };
}

export function emptyWeek(): DietDay[] {
  return DIET_WEEKDAYS.map(() => emptyDay());
}

/** Monday = 0 ... Sunday = 6, for opening the plan on today. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export const ACTIVITY_LEVELS: { factor: number; label: string; detail: string }[] = [
  { factor: 1, label: "BMR only", detail: "What the body burns at rest, no activity added. Not a target to eat to: pick their real activity for the plan." },
  { factor: 1.2, label: "Inactive", detail: "Desk job, little or no exercise" },
  { factor: 1.375, label: "Light", detail: "Training 1-3 days a week" },
  { factor: 1.55, label: "Active", detail: "Training 3-5 days a week" },
  { factor: 1.725, label: "Very active", detail: "Training 6-7 days a week, or a physical job" },
];

/** What the client picks on their intake: everything but "BMR only". */
export const INTAKE_ACTIVITY_LEVELS = ACTIVITY_LEVELS.filter((a) => a.factor !== 1);

/**
 * The client's own answers from the intake (height, weight, age, sex and
 * activity), for filling in the diet planner. Anything missing or out of
 * range comes back null, for the trainer to type in.
 */
export function intakeDetails(client: { intake_responses?: Record<string, unknown> | null; sex?: string | null }) {
  const answers = client.intake_responses ?? {};
  const num = (key: string, min: number, max: number) => {
    const n = Number(String(answers[key] ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const sex: DietSex | null = client.sex === "male" || client.sex === "female" ? client.sex : null;
  return {
    weight_kg: num("weight_kg", 25, 400),
    height_cm: num("height_cm", 100, 250),
    age: num("age", 12, 100),
    sex,
    activity: INTAKE_ACTIVITY_LEVELS.find((a) => a.label === answers.activity_level)?.factor ?? null,
  };
}

/** Basal metabolic rate (Mifflin-St Jeor), in kcal a day, or null without the details. */
export function bmr(plan: Pick<DietPlan, "weight_kg" | "height_cm" | "age" | "sex">): number | null {
  const { weight_kg, height_cm, age, sex } = plan;
  if (!weight_kg || !height_cm || !age || !sex) return null;
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === "male" ? 5 : -161));
}

/** Calories a day before the trainer's over or under: BMR times activity. */
export function dailyNeed(plan: Pick<DietPlan, "weight_kg" | "height_cm" | "age" | "sex" | "activity">): number | null {
  const base = bmr(plan);
  return base == null ? null : Math.round(base * plan.activity);
}

/** The client's calorie target for each day. */
export function dailyTarget(plan: Pick<DietPlan, "weight_kg" | "height_cm" | "age" | "sex" | "activity" | "adjust_kcal">): number | null {
  const need = dailyNeed(plan);
  return need == null ? null : need + plan.adjust_kcal;
}

// Safety floors (nutrition review, 2026-10-18): below these, or below the
// BMR, or more than 25% under what the body uses, a diet needs a dietitian.
export const SAFE_FLOOR_KCAL: Record<DietSex, number> = { female: 1200, male: 1500 };
export const MAX_DEFICIT_SHARE = 0.25;

/**
 * Why a calorie target is too low to use without a dietitian, in plain words,
 * or null when it's fine. `bmrKcal` and `need` are the client's BMR and what
 * their body uses with activity.
 */
export function lowTargetWarning(target: number | null, bmrKcal: number | null, need: number | null, sex: DietSex | null): string | null {
  if (target == null) return null;
  const reasons: string[] = [];
  if (sex && target < SAFE_FLOOR_KCAL[sex]) reasons.push(`under ${SAFE_FLOOR_KCAL[sex].toLocaleString()} kcal for a ${sex === "male" ? "man" : "woman"}`);
  if (bmrKcal != null && target < bmrKcal) reasons.push("under their BMR");
  if (need != null && target < need * (1 - MAX_DEFICIT_SHARE)) reasons.push("more than 25% under what their body uses");
  if (!reasons.length) return null;
  return `This target is ${reasons.join(", ")}. That's below what's safe without a registered dietitian. Refer them before using it.`;
}

// Health reasons a calorie-deficit plan needs a doctor or registered dietitian
// first (nutrition review, 2026-10-18), read from the intake's health answer.
const REFERRAL_CONDITIONS: { reason: string; match: RegExp }[] = [
  { reason: "diabetes", match: /diabet|metformin|insulin|blood sugar|glucose/i },
  { reason: "kidney disease", match: /kidney|renal|dialysis|\bckd\b/i },
  { reason: "pregnancy or breastfeeding", match: /pregnan|breast ?feed|nursing|expecting a baby/i },
  { reason: "an eating disorder, now or in the past", match: /eating disorder|anorexi|bulimi|binge|purg|arfid/i },
];

export const ADULT_AGE = 18;

/**
 * Why this client should see a doctor or registered dietitian before a
 * calorie-deficit plan: diabetes, kidney disease, pregnancy or breastfeeding,
 * an eating disorder (from what they wrote on the intake), or being under 18.
 * Empty when none apply. `age` overrides the intake's age when given.
 */
export function referralReasons(client: { intake_responses?: Record<string, unknown> | null }, age?: number | null): string[] {
  const answers = client.intake_responses ?? {};
  const detail = answers.has_health_condition_or_medication === "Yes" ? String(answers.health_condition_detail ?? "") : "";
  const reasons = REFERRAL_CONDITIONS.filter((c) => c.match.test(detail)).map((c) => c.reason);
  const years = age ?? Number(answers.age);
  if (Number.isFinite(years) && years > 0 && years < ADULT_AGE) reasons.push("being under 18");
  return reasons;
}

export const REFERRAL_NOTE =
  "Please check with your doctor or a registered dietitian (find one at adsa.org.za) before following a calorie-deficit plan. Until then, your plan is set to what your body uses.";

// The planner's food tabs, in the coach's words, and which number the trainer
// sets for a food in each: grams of protein, carbs, fibre or fat, or the
// food's own weight.
export type SetBy = "protein" | "carbs" | "fibre" | "fat" | "weight";

export const PLANNER_GROUPS: { group: FoodGroup; label: string; setBy: SetBy }[] = [
  { group: "Protein", label: "Protein", setBy: "protein" },
  { group: "Carbs", label: "Carbs", setBy: "carbs" },
  { group: "Fibre", label: "Fibre", setBy: "fibre" },
  { group: "Veg", label: "Veggies", setBy: "weight" },
  { group: "Fats", label: "Healthy fats", setBy: "fat" },
  { group: "Fruit & dairy", label: "Fruit & dairy", setBy: "weight" },
];

export function setByFor(food: Food): SetBy {
  const setBy = PLANNER_GROUPS.find((g) => g.group === food.group)?.setBy ?? "weight";
  // A food without that nutrient can only be set by weight.
  if (setBy !== "weight" && !perHundred(food, setBy)) return "weight";
  return setBy;
}

/** A sensible amount to start from when the trainer adds a food. */
export const DEFAULT_TARGET: Record<SetBy, number> = { protein: 30, carbs: 40, fibre: 5, fat: 10, weight: 100 };

function perHundred(food: Food, key: Exclude<SetBy, "weight">): number {
  return key === "fibre" ? food.fibre ?? 0 : food[key];
}

/**
 * The weight of a food that gives `amount` grams of protein, carbs, fibre or
 * fat (or `amount` itself when set by weight), rounded to 5 g.
 */
export function gramsFor(food: Food, setBy: SetBy, amount: number): number {
  if (!(amount > 0)) return 0;
  if (setBy === "weight") return Math.round(amount);
  const per = perHundred(food, setBy);
  if (!per) return 0;
  return Math.max(5, Math.round((amount / per) * 100 / 5) * 5);
}

export type DietTotals = { kcal: number; protein: number; carbs: number; fat: number; fibre: number };

export function findFood(name: string): Food | null {
  return FOODS.find((f) => f.name === name) ?? null;
}

/** What `grams` of a food gives, unrounded. Unknown foods give nothing. */
export function itemTotals(item: DietItem): DietTotals {
  const food = findFood(item.food);
  if (!food) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  const f = item.grams / 100;
  return { kcal: food.kcal * f, protein: food.protein * f, carbs: food.carbs * f, fat: food.fat * f, fibre: (food.fibre ?? 0) * f };
}

export function sumTotals(items: DietItem[]): DietTotals {
  const sum = items.map(itemTotals).reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
      fibre: a.fibre + b.fibre,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
  return {
    kcal: Math.round(sum.kcal),
    protein: Math.round(sum.protein),
    carbs: Math.round(sum.carbs),
    fat: Math.round(sum.fat),
    fibre: Math.round(sum.fibre),
  };
}

export function dayTotals(day: DietDay): DietTotals {
  return sumTotals(day.meals.flatMap((m) => m.items));
}

// Within this many kcal of the target counts as on target.
export const TARGET_MARGIN = 50;

export type TargetStatus = { state: "over" | "under" | "on"; by: number };

export function targetStatus(total: number, target: number): TargetStatus {
  const diff = total - target;
  if (diff > TARGET_MARGIN) return { state: "over", by: diff };
  if (diff < -TARGET_MARGIN) return { state: "under", by: -diff };
  return { state: "on", by: Math.abs(diff) };
}

/** "120 g", or "2 eggs" / "1.5 scoop" when the food has a handier measure. */
export function amountLabel(item: DietItem): string {
  const food = findFood(item.food);
  const unit = food?.name.endsWith("(ml)") ? "ml" : "g";
  const handy = food?.units?.[0];
  if (handy && handy.label !== "tsp" && handy.label !== "tbsp") {
    const count = Math.round((item.grams / handy.grams) * 2) / 2;
    if (count >= 0.5) return `${item.grams} ${unit} (about ${count} ${handy.label}${count === 1 ? "" : "s"})`;
  }
  return `${item.grams} ${unit}`;
}

/** Keeps the plan to 7 days of meals, whatever was saved. */
export function normaliseWeek(days: unknown): DietDay[] {
  const list = Array.isArray(days) ? (days as DietDay[]) : [];
  return DIET_WEEKDAYS.map((_, i) => {
    const day = list[i];
    return day && Array.isArray(day.meals) ? day : emptyDay();
  });
}
