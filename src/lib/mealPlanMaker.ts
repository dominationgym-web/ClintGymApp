import { FOODS, type Food, type FoodGroup } from "@/lib/foods";
import { findFood, gramsFor, itemTotals, type DietDay, type DietItem, type DietMeal } from "@/lib/dietPlan";

// The client's own meal plan maker (GRIZZ, 2026-10-12): they pick how many
// meals they eat, when, and when they train; the app builds a balanced day
// with medium carbs. Most carbs go in the meal before training and the reload
// meal after it, so the other meals stay low in carbs and insulin spikes stay
// small. A rest-day version spreads the carbs out and keeps the evening
// lighter. Any food can be swapped for another from the same group with the
// same protein, carbs or fat.

export type MealRole = "pre" | "post" | "meal";

export type MealPlanSettings = {
  /** Meal times as "HH:MM", in order. */
  meals: string[];
  /** When they usually train, "HH:MM", or null if they don't. */
  training: string | null;
};

export type MacroTargets = { kcal: number; protein: number; carbs: number; fat: number };

export const MIN_MEALS = 2;
export const MAX_MEALS = 6;

export const DEFAULT_TIMES: Record<number, string[]> = {
  2: ["10:00", "18:00"],
  3: ["07:00", "13:00", "19:00"],
  4: ["07:00", "11:00", "15:00", "19:00"],
  5: ["07:00", "10:00", "13:00", "16:00", "19:00"],
  6: ["06:30", "09:30", "12:30", "15:30", "18:00", "20:30"],
};

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** "07:00", or null if it isn't a time. */
export function cleanTime(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})(?:[:h.](\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Medium carbs: protein 2 g per kg (at most 250 g), fat about 27% of calories,
 * and carbs whatever is left (at least 80 g).
 */
export function macroTargets(kcal: number, weightKg: number): MacroTargets {
  const protein = Math.min(250, Math.round(weightKg * 2));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

/** Which meal is the pre-workout meal and which the post-workout reload. */
export function mealRoles(times: string[], training: string | null): MealRole[] {
  const roles: MealRole[] = times.map(() => "meal");
  if (!training) return roles;
  const t = minutes(training);
  let pre = -1;
  let post = -1;
  times.forEach((time, i) => {
    const m = minutes(time);
    if (m <= t - 45) pre = i;
    if (m >= t + 15 && post === -1) post = i;
  });
  if (pre >= 0) roles[pre] = "pre";
  if (post >= 0) roles[post] = "post";
  return roles;
}

export function mealLabel(time: string, role: MealRole): string {
  if (role === "pre") return `${time} · Pre-workout`;
  if (role === "post") return `${time} · Post-workout reload`;
  const h = minutes(time) / 60;
  const name = h < 10 ? "Breakfast" : h < 12 ? "Mid-morning" : h < 15 ? "Lunch" : h < 17 ? "Afternoon" : "Dinner";
  return `${time} · ${name}`;
}

/** Each meal's share of the day's carbs. */
export function carbShares(roles: MealRole[], times: string[], trainingDay: boolean): number[] {
  if (trainingDay && roles.some((r) => r !== "meal")) {
    const hasPre = roles.includes("pre");
    const hasPost = roles.includes("post");
    const preShare = hasPre ? (hasPost ? 0.3 : 0.45) : 0;
    const postShare = hasPost ? (hasPre ? 0.4 : 0.5) : 0;
    const others = roles.filter((r) => r === "meal").length;
    const rest = 1 - preShare - postShare;
    return roles.map((r) => (r === "pre" ? preShare : r === "post" ? postShare : others ? rest / others : 0)).map((s, _, all) =>
      others ? s : s / all.reduce((a, b) => a + b, 0),
    );
  }
  // Rest day: spread out, with a lighter evening.
  const weights = times.map((t) => (minutes(t) >= 18 * 60 ? 0.5 : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

/** Each meal's share of the day's fat: less around training, for digestion. */
export function fatShares(roles: MealRole[], trainingDay: boolean): number[] {
  const weights = roles.map((r) => (trainingDay && r !== "meal" ? 0.4 : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

type Slot = "breakfast" | "pre" | "post" | "main";

const POOLS: Record<Slot, { protein: string[]; carbs: string[]; veg: boolean; fat: string[] }> = {
  breakfast: {
    protein: ["Eggs", "Whey protein powder", "Eggs", "Biltong, lean, medium"],
    carbs: ["Pap / maize porridge (cooked)", "Wholewheat wrap", "Sweet potato (cooked)", "Baby potatoes (boiled)"],
    veg: false,
    fat: ["Avocado", "Almonds", "Avocado", "Pumpkin seeds"],
  },
  pre: {
    protein: ["Chicken breast (cooked)", "Whey protein powder", "Tuna in water (drained)", "Biltong, lean, medium", "Turkey breast (cooked)"],
    carbs: ["White rice (cooked)", "Potatoes (boiled)", "Basmati rice (cooked)", "Pasta (cooked)", "Baby potatoes (boiled)"],
    veg: false,
    fat: ["Almonds", "Avocado"],
  },
  post: {
    protein: ["Chicken breast (cooked)", "Lean beef mince (cooked)", "Hake / white fish (cooked)", "Ostrich steak (cooked)", "Lean turkey mince (cooked)"],
    carbs: ["White rice (cooked)", "Potatoes (boiled)", "Basmati rice (cooked)", "Pasta (cooked)", "Sweet potato (cooked)"],
    veg: true,
    fat: ["Olive oil", "Avocado"],
  },
  main: {
    protein: ["Chicken breast (cooked)", "Beef steak (cooked)", "Salmon (cooked)", "Ostrich steak (cooked)", "Turkey breast (cooked)", "Hake / white fish (cooked)", "Lean beef mince (cooked)"],
    carbs: ["Sweet potato (cooked)", "Brown rice (cooked)", "Quinoa (cooked)", "Baby potatoes (boiled)", "Wholewheat pasta (cooked)"],
    veg: true,
    fat: ["Avocado", "Olive oil", "Feta", "Mixed nuts, unsalted", "Pumpkin seeds"],
  },
};

const VEG = ["Broccoli", "Green beans", "Mixed salad leaves", "Spinach", "Cauliflower", "Peppers", "Baby marrow", "Butternut"];

// Most of a food that makes sense in one meal; the rest of the protein comes
// from the top-up food, if there is one.
const MAX_GRAMS: Record<string, number> = { Eggs: 150, "Whey protein powder": 60, "Biltong, lean, medium": 100 };
const TOP_UP: Record<string, string> = { Eggs: "Egg whites" };

const pick = (list: string[], n: number) => list[((n % list.length) + list.length) % list.length];

function slotFor(role: MealRole, time: string, index: number): Slot {
  if (role === "pre") return "pre";
  if (role === "post") return "post";
  return index === 0 && minutes(time) < 10 * 60 ? "breakfast" : "main";
}

const item = (food: string, grams: number): DietItem => ({ food, grams });

function buildMeal(slot: Slot, protein: number, carbs: number, fat: number, n: number): DietItem[] {
  const pool = POOLS[slot];
  const sides: DietItem[] = [];
  if (pool.veg) sides.push(item(pick(VEG, n + slot.length), 100));
  const vegCarbs = sides.reduce((t, i) => t + itemTotals(i).carbs, 0);
  if (carbs - vegCarbs >= 10) {
    const carbName = pick(pool.carbs, n);
    sides.push(item(carbName, gramsFor(findFood(carbName) as Food, "carbs", carbs - vegCarbs)));
  }
  // Carbs and veg bring some protein too, so the protein food makes up the rest.
  const sideProtein = sides.reduce((t, i) => t + itemTotals(i).protein, 0);
  const wanted = Math.max(protein * 0.6, protein - sideProtein);
  const proteinName = pick(pool.protein, n);
  const proteinItems = [item(proteinName, gramsFor(findFood(proteinName) as Food, "protein", wanted))];
  const max = MAX_GRAMS[proteinName];
  if (max && proteinItems[0].grams > max) {
    proteinItems[0] = item(proteinName, max);
    const topUp = TOP_UP[proteinName];
    const left = wanted - itemTotals(proteinItems[0]).protein;
    if (topUp && left >= 5) proteinItems.push(item(topUp, gramsFor(findFood(topUp) as Food, "protein", left)));
  }
  const items = [...proteinItems, ...sides];
  const fatSoFar = items.reduce((t, i) => t + itemTotals(i).fat, 0);
  if (fat - fatSoFar >= 4) {
    const fatName = pick(pool.fat, n);
    items.push(item(fatName, gramsFor(findFood(fatName) as Food, "fat", fat - fatSoFar)));
  }
  return items;
}

/**
 * One day of meals. `trainingDay` puts the carbs around training; `variety`
 * picks different foods each time the client asks for a new plan.
 */
export function makeDay(settings: MealPlanSettings, targets: MacroTargets, trainingDay: boolean, variety = 0): DietDay {
  const times = [...settings.meals].sort((a, b) => minutes(a) - minutes(b));
  const roles = mealRoles(times, trainingDay ? settings.training : null);
  const carbs = carbShares(roles, times, trainingDay);
  const fats = fatShares(roles, trainingDay);
  const proteinEach = targets.protein / times.length;
  const meals: DietMeal[] = times.map((time, i) => ({
    name: mealLabel(time, roles[i]),
    items: buildMeal(slotFor(roles[i], time, i), proteinEach, targets.carbs * carbs[i], targets.fat * fats[i], variety + i * 3),
  }));
  return { meals };
}

// Which number a swap keeps the same, by food group.
const SWAP_KEEPS: Record<FoodGroup, "protein" | "carbs" | "fat" | "fibre" | "weight"> = {
  Protein: "protein",
  Carbs: "carbs",
  Fibre: "fibre",
  Veg: "weight",
  Fats: "fat",
  "Fruit & dairy": "carbs",
};

/** Foods that can replace this one: the rest of its group. */
export function swapOptions(foodName: string): Food[] {
  const food = findFood(foodName);
  if (!food) return [];
  return FOODS.filter((f) => f.group === food.group && f.name !== food.name);
}

/** The new food, with the amount that gives the same protein, carbs or fat. */
export function swapItem(current: DietItem, newFood: string): DietItem {
  const from = findFood(current.food);
  const to = findFood(newFood);
  if (!from || !to) return current;
  const keep = SWAP_KEEPS[from.group];
  if (keep === "weight") return { food: to.name, grams: current.grams };
  const amount = itemTotals(current)[keep];
  const grams = gramsFor(to, keep, amount);
  return { food: to.name, grams: grams > 0 ? grams : current.grams };
}
