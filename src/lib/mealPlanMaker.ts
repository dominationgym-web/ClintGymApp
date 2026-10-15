import { FOODS, type Food, type FoodGroup } from "@/lib/foods";
import { findFood, gramsFor, itemTotals, type DietDay, type DietItem, type DietMeal } from "@/lib/dietPlan";

// The client's own meal plan maker (GRIZZ, 2026-10-12): they pick how many
// meals they eat, when, and when they train; the app builds a balanced day
// with medium carbs. Most carbs go in the meal before training and the reload
// meal after it, so the other meals stay low in carbs and insulin spikes stay
// small. A rest-day version spreads the carbs out and keeps the evening
// lighter. Any food can be swapped for another from the same group with the
// same protein, carbs or fat.
//
// Every plan gets a biltong snack to help reach the protein goal (GRIZZ,
// 2026-10-12: it works well for ladies who don't eat a lot). Vegetarians and
// pescatarians get a Greek yoghurt snack instead, and only foods they eat.

export type MealRole = "pre" | "post" | "meal";

export type MealGoal = "coach" | "lose" | "maintain" | "gain";

export type MealDiet = "everything" | "vegetarian" | "pescatarian";

export const MEAL_DIETS: { key: MealDiet; label: string; detail: string }[] = [
  { key: "everything", label: "I eat everything", detail: "Meat, chicken, fish, eggs and dairy" },
  { key: "pescatarian", label: "Pescatarian", detail: "No meat or chicken, but fish and seafood are fine" },
  { key: "vegetarian", label: "Vegetarian", detail: "No meat, chicken or fish. Eggs and dairy are fine" },
];

export type MealPlanSettings = {
  /** Meal times as "HH:MM", in order. */
  meals: string[];
  /** When they usually train, "HH:MM", or null if they don't. */
  training: string | null;
  goal?: MealGoal;
  diet?: MealDiet;
};

const MEAT = /chicken|beef|ostrich|biltong|pork|lamb|turkey/i;
const FISH = /salmon|hake|fish|tuna|prawn|sardine|pilchard/i;

/** Whether someone on this diet eats the food. */
export function dietAllows(foodName: string, diet: MealDiet = "everything"): boolean {
  if (diet === "everything") return true;
  if (MEAT.test(foodName)) return false;
  return diet === "pescatarian" || !FISH.test(foodName);
}

// The goal moves the day's calories off what the body uses (BMR plus
// activity): eat less to lose weight, more to build muscle.
export const MEAL_GOALS: { key: Exclude<MealGoal, "coach">; label: string; adjust: number; detail: string }[] = [
  { key: "lose", label: "Lose weight", adjust: -400, detail: "About 400 kcal a day under what your body uses" },
  { key: "maintain", label: "Stay the same", adjust: 0, detail: "Eat what your body uses" },
  { key: "gain", label: "Build muscle", adjust: 300, detail: "About 300 kcal a day over what your body uses" },
];

// Never plan a day lower than this, whatever the goal.
export const MIN_KCAL = 1200;

/** The day's calories for a goal; "coach" uses the coach's own target. */
export function goalKcal(need: number, goal: MealGoal, coachKcal: number | null): number {
  if (goal === "coach" && coachKcal) return coachKcal;
  const adjust = MEAL_GOALS.find((g) => g.key === goal)?.adjust ?? 0;
  return Math.max(MIN_KCAL, need + adjust);
}

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
 *
 * Losing weight is low carb (GRIZZ, 2026-10-12): protein 2.2 g per kg, carbs
 * about 20% of calories (50 g to 150 g), and fat the rest. Fewer carbs mean
 * smaller insulin spikes, so the body burns more stored fat.
 */
export function macroTargets(kcal: number, weightKg: number, goal: MealGoal = "maintain"): MacroTargets {
  if (goal === "lose") {
    const protein = Math.min(250, Math.round(weightKg * 2.2));
    const carbs = Math.min(150, Math.max(50, Math.round((kcal * 0.2) / 4)));
    const fat = Math.max(30, Math.round((kcal - protein * 4 - carbs * 4) / 9));
    return { kcal, protein, carbs, fat };
  }
  const protein = Math.min(250, Math.round(weightKg * 2));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

// When they train, for the meal plan maker (GRIZZ, 2026-10-12): the carbs go
// in the meals before and after it.
export const TRAINING_TIMES: { key: string; label: string; time: string }[] = [
  { key: "morning", label: "Morning", time: "06:30" },
  { key: "midday", label: "Midday", time: "12:30" },
  { key: "evening", label: "Evening", time: "17:30" },
];

/**
 * Meal times that fit around training: a small pre-workout meal at least
 * 45 minutes before and the reload meal soon after, with the rest spread
 * through the day.
 */
export function mealTimesFor(count: number, training: string | null): string[] {
  const base = DEFAULT_TIMES[count] ?? DEFAULT_TIMES[4];
  if (!training) return base;
  const t = minutes(training);
  const fmt = (m: number) => {
    const r = Math.round(m / 15) * 15;
    return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
  };
  const pre = t - 90 >= 5 * 60 + 30 ? t - 90 : t - 45;
  const post = t + 75;
  // Morning trainers eat a small meal first thing and breakfast after.
  const times = new Set<number>([pre, post]);
  const others = base.map(minutes).filter((m) => Math.abs(m - t) > 150);
  for (const m of others) {
    if (times.size >= count) break;
    times.add(m);
  }
  // Still short (a lot of meals): fill the longest gaps.
  for (let guard = 0; times.size < count && guard < 10; guard++) {
    const sorted = [...times].sort((a, b) => a - b);
    let gapAt = sorted[sorted.length - 1] + 150;
    let best = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > best) {
        best = sorted[i] - sorted[i - 1];
        gapAt = sorted[i - 1] + best / 2;
      }
    }
    times.add(Math.round(gapAt / 15) * 15);
  }
  return [...times]
    .filter((m) => m >= 5 * 60 && m <= 22 * 60)
    .sort((a, b) => a - b)
    .map(fmt);
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

// Proteins for people who don't eat meat, by meal.
const NO_MEAT_PROTEIN: Record<MealDiet, Partial<Record<Slot, string[]>>> = {
  everything: {},
  pescatarian: {
    pre: ["Whey protein powder", "Tuna in water (drained)", "Hake / white fish (cooked)"],
    post: ["Hake / white fish (cooked)", "Salmon (cooked)", "Tuna in water (drained)", "Prawns (cooked)"],
    main: ["Salmon (cooked)", "Hake / white fish (cooked)", "Prawns (cooked)", "Tuna in water (drained)", "Pilchards in tomato sauce"],
  },
  vegetarian: {
    breakfast: ["Eggs", "Greek yoghurt, plain", "Eggs", "Whey protein powder"],
    pre: ["Whey protein powder", "Egg whites", "Greek yoghurt, plain"],
    post: ["Tofu, firm", "Eggs", "Whey protein powder", "Cottage cheese, low fat"],
    main: ["Tofu, firm", "Eggs", "Cottage cheese, low fat", "Tofu, firm", "Egg whites"],
  },
};

function proteinPool(slot: Slot, diet: MealDiet): string[] {
  return NO_MEAT_PROTEIN[diet][slot] ?? POOLS[slot].protein.filter((f) => dietAllows(f, diet));
}

/** The daily protein snack: biltong, or Greek yoghurt for non meat eaters. */
export function proteinSnack(targets: MacroTargets, diet: MealDiet = "everything"): DietItem {
  if (diet !== "everything") return { food: "Greek yoghurt, plain", grams: targets.protein >= 140 ? 250 : 175 };
  return { food: "Biltong, lean, medium", grams: targets.protein >= 140 ? 60 : 30 };
}

/** When to have the snack: in the middle of the longest gap between meals. */
export function snackTime(times: string[]): string {
  let best = -1;
  let at = minutes(times[0]) + 120;
  for (let i = 1; i < times.length; i++) {
    const gap = minutes(times[i]) - minutes(times[i - 1]);
    if (gap > best) {
      best = gap;
      at = minutes(times[i - 1]) + gap / 2;
    }
  }
  const rounded = Math.round(at / 15) * 15;
  return `${String(Math.floor(rounded / 60) % 24).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

const VEG = ["Broccoli", "Green beans", "Mixed salad leaves", "Spinach", "Cauliflower", "Peppers", "Baby marrow", "Butternut"];

// Most of a food that makes sense in one meal; the rest of the protein comes
// from the top-up food, if there is one.
const MAX_GRAMS: Record<string, number> = {
  Eggs: 150,
  "Whey protein powder": 60,
  "Biltong, lean, medium": 100,
  "Tofu, firm": 250,
  "Cottage cheese, low fat": 250,
  "Greek yoghurt, plain": 250,
};
const TOP_UP: Record<string, string> = {
  Eggs: "Egg whites",
  "Tofu, firm": "Egg whites",
  "Cottage cheese, low fat": "Whey protein powder",
  "Greek yoghurt, plain": "Whey protein powder",
};

// The most of one carb food in a meal.
const MAX_CARB_GRAMS = 300;

const pick = (list: string[], n: number) => list[((n % list.length) + list.length) % list.length];

function slotFor(role: MealRole, time: string, index: number): Slot {
  if (role === "pre") return "pre";
  if (role === "post") return "post";
  return index === 0 && minutes(time) < 10 * 60 ? "breakfast" : "main";
}

const item = (food: string, grams: number): DietItem => ({ food, grams });

function buildMeal(slot: Slot, protein: number, carbs: number, fat: number, n: number, diet: MealDiet): DietItem[] {
  const pool = POOLS[slot];
  const sides: DietItem[] = [];
  if (pool.veg) sides.push(item(pick(VEG, n + slot.length), 100));
  const vegCarbs = sides.reduce((t, i) => t + itemTotals(i).carbs, 0);
  if (carbs - vegCarbs >= 10) {
    const carbName = pick(pool.carbs, n);
    const grams = gramsFor(findFood(carbName) as Food, "carbs", carbs - vegCarbs);
    if (grams <= MAX_CARB_GRAMS) {
      sides.push(item(carbName, grams));
    } else {
      // A big carb meal (building muscle) gets two carb foods, not a mountain of one.
      sides.push(item(carbName, MAX_CARB_GRAMS));
      const left = carbs - vegCarbs - itemTotals(sides[sides.length - 1]).carbs;
      const second = pool.carbs.find((c) => c !== carbName && !/potato|wrap/i.test(c)) ?? "White rice (cooked)";
      if (left >= 10) sides.push(item(second, gramsFor(findFood(second) as Food, "carbs", left)));
    }
  }
  // Carbs and veg bring some protein too, so the protein food makes up the rest.
  const sideProtein = sides.reduce((t, i) => t + itemTotals(i).protein, 0);
  const wanted = Math.max(protein * 0.7, protein - sideProtein);
  const proteinName = pick(proteinPool(slot, diet), n);
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
    const fatName = pick(pool.fat.filter((f) => dietAllows(f, diet)), n);
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
  const diet = settings.diet ?? "everything";
  // The snack's protein, carbs and fat come off what the meals need.
  const snack = proteinSnack(targets, diet);
  const s = itemTotals(snack);
  const proteinEach = Math.max(0, targets.protein - s.protein) / times.length;
  const carbsLeft = Math.max(0, targets.carbs - s.carbs);
  const fatLeft = Math.max(0, targets.fat - s.fat);
  const meals: DietMeal[] = times.map((time, i) => ({
    name: mealLabel(time, roles[i]),
    items: buildMeal(slotFor(roles[i], time, i), proteinEach, carbsLeft * carbs[i], fatLeft * fats[i], variety + i * 3, diet),
  }));
  const at = snackTime(times);
  const snackMeal: DietMeal = { name: `${at} · Protein snack`, items: [snack] };
  const index = times.findIndex((t) => minutes(t) > minutes(at));
  meals.splice(index === -1 ? meals.length : index, 0, snackMeal);
  return trimFats({ meals }, targets.kcal);
}

// Rounding, veg and the protein foods' own fat can push a day over its
// calories; trim the added fats (oil, nuts, avocado) to bring it back.
function trimFats(day: DietDay, kcal: number): DietDay {
  const total = day.meals.reduce((t, m) => t + m.items.reduce((a, i) => a + itemTotals(i).kcal, 0), 0);
  let over = total - kcal - 25;
  if (over <= 0) return day;
  const meals = day.meals.map((m) => ({
    ...m,
    items: m.items
      .map((it) => {
        const food = findFood(it.food);
        if (over <= 0 || !food || food.group !== "Fats") return it;
        const cut = Math.min(it.grams, Math.ceil(((over / food.kcal) * 100) / 5) * 5);
        over -= (cut * food.kcal) / 100;
        return { ...it, grams: it.grams - cut };
      })
      .filter((it) => it.grams > 0),
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
export function swapOptions(foodName: string, diet: MealDiet = "everything"): Food[] {
  const food = findFood(foodName);
  if (!food) return [];
  return FOODS.filter((f) => f.group === food.group && f.name !== food.name && dietAllows(f.name, diet));
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
