import { FOODS, type Food, type FoodGroup } from "@/lib/foods";
import { findFood, gramsFor, itemTotals, sumTotals, type DietDay, type DietItem, type DietMeal } from "@/lib/dietPlan";

// The client's own meal plan maker (GRIZZ, 2026-10-12): they pick how many
// meals they eat, when, and when they train; the app builds a balanced day
// with medium carbs. Most carbs go in the meal before training and the reload
// meal after it, when they fuel the session best. A rest-day version spreads
// the carbs out and keeps the evening lighter. Any food can be swapped for
// another from the same group with the same protein, carbs or fat.
//
// Every plan gets a biltong snack to help reach the protein goal (GRIZZ,
// 2026-10-12: it works well for ladies who don't eat a lot), with a piece of
// fruit. Vegetarians and pescatarians get a Greek yoghurt snack instead, and
// only foods they eat. Biltong is only ever the snack, so at most once a day.
//
// Nutrition review (2026-10-18): every day gets veg at most meals, a fruit,
// legumes in the main meals, a dairy food (unless dairy-free) and at least
// about 25 g of fibre, and lands within the app's own "on target" margin.

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
  /** No milk, yoghurt, cheese or whey (lactose intolerance or allergy). */
  dairyFree?: boolean;
};

const MEAT = /chicken|beef|ostrich|biltong|pork|lamb|turkey/i;
const FISH = /salmon|hake|fish|tuna|prawn|sardine|pilchard/i;
const DAIRY = /milk|yoghurt|cottage cheese|cheddar|feta|butter$|whey/i;

/** Whether someone on this diet eats the food. */
export function dietAllows(foodName: string, diet: MealDiet = "everything"): boolean {
  if (diet === "everything") return true;
  if (MEAT.test(foodName)) return false;
  return diet === "pescatarian" || !FISH.test(foodName);
}

/** Whether the food fits the client's diet and, if they're dairy-free, has no dairy. */
export function foodAllowed(foodName: string, diet: MealDiet = "everything", dairyFree = false): boolean {
  return dietAllows(foodName, diet) && !(dairyFree && DAIRY.test(foodName));
}

// The goal moves the day's calories off what the body uses (BMR plus
// activity): eat less to lose weight, more to build muscle. Losing weight is
// a share of what the body uses (nutrition review, 2026-10-18), so a small
// person isn't cut as hard as a big one.
export const LOSE_SHARE = 0.18;
export const GAIN_KCAL = 300;
export const MEAL_GOALS: { key: Exclude<MealGoal, "coach">; label: string; detail: string }[] = [
  { key: "lose", label: "Lose weight", detail: "About 15 to 20% under what your body uses" },
  { key: "maintain", label: "Stay the same", detail: "Eat what your body uses" },
  { key: "gain", label: "Build muscle", detail: "About 300 kcal a day over what your body uses" },
];

// Never plan a weight-loss day below this, or below the BMR, without a
// dietitian (nutrition review, 2026-10-18).
export const MIN_KCAL: Record<"male" | "female", number> = { female: 1200, male: 1500 };

/** The lowest safe day for this person: their sex's floor or their BMR, whichever is higher. */
export function kcalFloor(sex: "male" | "female" | null | undefined, bmrKcal?: number | null): number {
  return Math.max(MIN_KCAL[sex ?? "female"], bmrKcal ?? 0);
}

/**
 * The day's calories for a goal; "coach" uses the coach's own target. A
 * weight-loss day never goes under the floor (and never over what the body
 * uses: if the floor is above that, they eat what they use).
 */
export function goalKcal(
  need: number,
  goal: MealGoal,
  coachKcal: number | null,
  body: { sex?: "male" | "female" | null; bmr?: number | null } = {},
): number {
  if (goal === "coach" && coachKcal) return coachKcal;
  if (goal === "gain") return need + GAIN_KCAL;
  if (goal !== "lose") return need;
  const cut = Math.round((need * (1 - LOSE_SHARE)) / 10) * 10;
  return Math.min(need, Math.max(kcalFloor(body.sex, body.bmr), cut));
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
 * The weight protein is worked out on. With a BMI over 30 it's the weight at
 * a BMI of 25 for their height (nutrition review, 2026-10-18; the trainer
 * guide says the same: "base it on goal weight"), so a 110 kg woman isn't
 * given 240 g of protein. Without a height it's their weight.
 */
export function proteinWeight(weightKg: number, heightCm?: number | null): number {
  if (!heightCm) return weightKg;
  const m = heightCm / 100;
  return weightKg / (m * m) > 30 ? Math.round(25 * m * m) : weightKg;
}

/**
 * Medium carbs: protein 2 g per kg (at most 250 g, and at most 40% of the
 * calories), fat about 27% of calories, and carbs whatever is left (at least
 * 80 g). The kg are the protein weight above.
 *
 * Losing weight (nutrition review, 2026-10-18): protein 2.2 g per kg, which
 * keeps muscle and keeps you full, fat about 30% and carbs the rest. Fat loss
 * comes from the calorie deficit, not from cutting carbs, so the plan keeps
 * enough carbs for fruit, legumes and whole grains.
 */
export function macroTargets(kcal: number, weightKg: number, goal: MealGoal = "maintain", heightCm?: number | null): MacroTargets {
  const perKg = goal === "lose" ? 2.2 : 2;
  const protein = Math.min(250, Math.round((kcal * 0.4) / 4), Math.round(proteinWeight(weightKg, heightCm) * perKg));
  let fat = Math.round((kcal * (goal === "lose" ? 0.3 : 0.27)) / 9);
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));
  // The 80 g of carbs comes out of the fat, so the day still adds up.
  if (protein * 4 + carbs * 4 + fat * 9 > kcal + 20) fat = Math.max(30, Math.round((kcal - protein * 4 - carbs * 4) / 9));
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

const VEG = ["Broccoli", "Green beans", "Mixed salad leaves", "Spinach", "Cauliflower", "Peppers", "Baby marrow", "Butternut", "Cabbage", "Carrots"];

// Biltong is only the snack, never in these pools, so it's at most once a day.
// Legumes (lentils, chickpeas, beans) are in the main and reload meals for
// fibre; the pre-workout meal stays low in fibre so it sits well.
const POOLS: Record<Slot, { protein: string[]; carbs: string[]; veg: string[]; fat: string[] }> = {
  breakfast: {
    protein: ["Eggs", "Whey protein powder", "Eggs", "Greek yoghurt, plain"],
    carbs: ["Brown bread", "Pap / maize porridge (cooked)", "Wholewheat wrap", "Sweet potato (cooked)", "Baby potatoes (boiled)"],
    veg: ["Spinach", "Tomato", "Mushrooms"],
    fat: ["Avocado", "Almonds", "Avocado", "Pumpkin seeds"],
  },
  pre: {
    protein: ["Chicken breast (cooked)", "Whey protein powder", "Tuna in water (drained)", "Turkey breast (cooked)"],
    carbs: ["White rice (cooked)", "Potatoes (boiled)", "Basmati rice (cooked)", "Pasta (cooked)", "Baby potatoes (boiled)"],
    veg: [],
    fat: ["Almonds", "Avocado"],
  },
  post: {
    protein: ["Chicken breast (cooked)", "Lean beef mince (cooked)", "Hake / white fish (cooked)", "Ostrich steak (cooked)", "Lean turkey mince (cooked)"],
    carbs: ["Basmati rice (cooked)", "Lentils (cooked)", "Potatoes (boiled)", "Chickpeas (cooked)", "Sweet potato (cooked)"],
    veg: VEG,
    fat: ["Olive oil", "Avocado"],
  },
  main: {
    protein: ["Chicken breast (cooked)", "Beef steak (cooked)", "Salmon (cooked)", "Ostrich steak (cooked)", "Turkey breast (cooked)", "Hake / white fish (cooked)", "Lean beef mince (cooked)"],
    carbs: ["Lentils (cooked)", "Sweet potato (cooked)", "Chickpeas (cooked)", "Brown rice (cooked)", "Kidney beans (cooked)", "Baby potatoes (boiled)", "Wholewheat pasta (cooked)", "Quinoa (cooked)"],
    veg: VEG,
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

type Prefs = { diet: MealDiet; dairyFree: boolean };

function proteinPool(slot: Slot, { diet, dairyFree }: Prefs): string[] {
  const list = (NO_MEAT_PROTEIN[diet][slot] ?? POOLS[slot].protein).filter((f) => foodAllowed(f, diet, dairyFree));
  return list.length ? list : diet === "everything" ? ["Chicken breast (cooked)"] : diet === "pescatarian" ? ["Tuna in water (drained)"] : ["Eggs"];
}

// A piece of fruit with the snack, different each day.
const FRUIT = ["Apple", "Pear", "Berries", "Banana", "Raspberries"];
// The daily dairy for meat eaters (vegetarians and pescatarians get it in the snack).
const DAIRY_FOODS: DietItem[] = [
  { food: "Low fat milk (ml)", grams: 250 },
  { food: "Greek yoghurt, plain", grams: 150 },
  { food: "Cottage cheese, low fat", grams: 100 },
];

/** The daily protein snack: biltong, or Greek yoghurt for non meat eaters (eggs or tuna if dairy-free). */
export function proteinSnack(targets: MacroTargets, diet: MealDiet = "everything", dairyFree = false): DietItem {
  const big = targets.protein >= 140;
  if (diet === "everything") return { food: "Biltong, lean, medium", grams: big ? 60 : 30 };
  if (!dairyFree) return { food: "Greek yoghurt, plain", grams: big ? 250 : 175 };
  return diet === "pescatarian" ? { food: "Tuna in water (drained)", grams: big ? 120 : 80 } : { food: "Eggs", grams: big ? 150 : 100 };
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

// Fibre a day (WHO 2023: at least 25 g).
export const FIBRE_TARGET = 25;

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

function buildMeal(slot: Slot, protein: number, carbs: number, fat: number, n: number, prefs: Prefs, extras: DietItem[] = []): DietItem[] {
  const pool = POOLS[slot];
  const sides: DietItem[] = [...extras];
  if (pool.veg.length) sides.push(item(pick(pool.veg, n + slot.length), slot === "breakfast" ? 100 : 150));
  const sideCarbs = sides.reduce((t, i) => t + itemTotals(i).carbs, 0);
  if (carbs - sideCarbs >= 10) {
    const carbName = pick(pool.carbs, n);
    const grams = gramsFor(findFood(carbName) as Food, "carbs", carbs - sideCarbs);
    if (grams <= MAX_CARB_GRAMS) {
      sides.push(item(carbName, grams));
    } else {
      // A big carb meal (building muscle) gets two carb foods, not a mountain of one.
      sides.push(item(carbName, MAX_CARB_GRAMS));
      const left = carbs - sideCarbs - itemTotals(sides[sides.length - 1]).carbs;
      const second = pool.carbs.find((c) => c !== carbName && !/potato|wrap|bread|lentil|chickpea|bean/i.test(c)) ?? "White rice (cooked)";
      if (left >= 10) sides.push(item(second, gramsFor(findFood(second) as Food, "carbs", left)));
    }
  }
  // Carbs, veg and dairy bring some protein too, so the protein food makes up the rest.
  const sideProtein = sides.reduce((t, i) => t + itemTotals(i).protein, 0);
  const wanted = Math.max(protein * 0.5, protein - sideProtein);
  const proteinName = pick(proteinPool(slot, prefs), n);
  const proteinItems = [item(proteinName, gramsFor(findFood(proteinName) as Food, "protein", wanted))];
  const max = MAX_GRAMS[proteinName];
  if (max && proteinItems[0].grams > max) {
    proteinItems[0] = item(proteinName, max);
    const topUp = TOP_UP[proteinName];
    const left = wanted - itemTotals(proteinItems[0]).protein;
    if (topUp && foodAllowed(topUp, prefs.diet, prefs.dairyFree) && left >= 5)
      proteinItems.push(item(topUp, gramsFor(findFood(topUp) as Food, "protein", left)));
  }
  const items = [...proteinItems, ...sides];
  const fatSoFar = items.reduce((t, i) => t + itemTotals(i).fat, 0);
  const fats = pool.fat.filter((f) => foodAllowed(f, prefs.diet, prefs.dairyFree));
  if (fat - fatSoFar >= 4 && fats.length) {
    const fatName = pick(fats, n);
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
  const prefs: Prefs = { diet: settings.diet ?? "everything", dairyFree: !!settings.dairyFree };
  // The snack (protein plus a fruit) and the meat eater's daily dairy are set
  // first; their protein, carbs and fat come off what the meals need.
  const snackItems = [proteinSnack(targets, prefs.diet, prefs.dairyFree), item(pick(FRUIT, variety), 0)];
  snackItems[1].grams = findFood(snackItems[1].food)?.usual ?? 120;
  const dairy = prefs.diet === "everything" && !prefs.dairyFree ? [DAIRY_FOODS[((variety % 3) + 3) % 3]] : [];
  const fixed = sumTotals([...snackItems, ...dairy]);
  const proteinEach = Math.max(0, targets.protein - fixed.protein) / times.length;
  const carbsLeft = Math.max(0, targets.carbs - fixed.carbs);
  const fatLeft = Math.max(0, targets.fat - fixed.fat);
  const meals: DietMeal[] = times.map((time, i) => ({
    name: mealLabel(time, roles[i]),
    items: buildMeal(slotFor(roles[i], time, i), proteinEach, carbsLeft * carbs[i], fatLeft * fats[i], variety + i * 3, prefs, i === 0 ? dairy : []),
  }));
  const at = snackTime(times);
  const snackMeal: DietMeal = { name: `${at} · Protein snack`, items: snackItems };
  const index = times.findIndex((t) => minutes(t) > minutes(at));
  meals.splice(index === -1 ? meals.length : index, 0, snackMeal);
  let day = fitKcal({ meals }, targets.kcal);
  // Fitting the calories can trim some fibre, so check it twice.
  for (let round = 0; round < 2 && dayFibre(day) < FIBRE_TARGET; round++) day = fitKcal(addFibre(day), targets.kcal);
  return day;
}

// Short of fibre: more veg at the meals that have it, then a spoon of chia
// seeds with the snack.
function addFibre(day: DietDay): DietDay {
  let meals = day.meals;
  // A little over the target, as fitting the calories afterwards can trim some.
  const aim = FIBRE_TARGET + 2;
  const fibre = () => sumTotals(meals.flatMap((m) => m.items)).fibre;
  const veg = new Set([...VEG, ...POOLS.breakfast.veg]);
  for (let round = 0; round < 3 && fibre() < aim; round++) {
    meals = meals.map((m) => ({ ...m, items: m.items.map((it) => (veg.has(it.food) ? { ...it, grams: it.grams + 50 } : it)) }));
  }
  if (fibre() < aim) {
    const snack = meals.findIndex((m) => m.name.includes("Protein snack"));
    const grams = Math.min(36, Math.ceil(((aim - fibre()) / 34) * 100 / 12) * 12);
    meals = meals.map((m, i) => (i === snack ? { ...m, items: [...m.items, item("Chia seeds", grams)] } : m));
  }
  return { meals };
}

const dayFibre = (day: DietDay) => sumTotals(day.meals.flatMap((m) => m.items)).fibre;
const kcalOf = (day: DietDay) => day.meals.reduce((t, m) => t + m.items.reduce((a, i) => a + itemTotals(i).kcal, 0), 0);

// Rounding, veg, fruit and the protein foods' own fat can push a day off its
// calories: trim the added fats (oil, nuts, avocado) first, then the carbs,
// or add carbs if it's short. Eggs, tofu and yoghurt can bring more fat than
// the day has room for, so a day still over gets a little less of its
// protein foods (at most a fifth). The day lands within the "on target" margin.
function fitKcal(day: DietDay, kcal: number): DietDay {
  let fitted = trimFats(day, kcal);
  for (let round = 0; round < 3; round++) {
    const off = kcalOf(fitted) - kcal;
    if (Math.abs(off) <= 25) break;
    // Cutting keeps the legumes (they bring the fibre) when there's another carb to cut.
    const carb = (name: string, keepFibre: boolean) => {
      const food = findFood(name);
      return food?.group === "Carbs" && !(keepFibre && (food.fibre ?? 0) >= 5);
    };
    const all = fitted.meals.flatMap((m) => m.items);
    const keepFibre = off > 0 && all.some((i) => carb(i.food, true));
    const carbKcal = all.reduce((t, i) => t + (carb(i.food, keepFibre) ? itemTotals(i).kcal : 0), 0);
    if (carbKcal <= 0) break;
    const factor = Math.min(1.6, Math.max(0.4, (carbKcal - off) / carbKcal));
    fitted = scale(fitted, (name) => carb(name, keepFibre), factor);
  }
  const over = kcalOf(fitted) - kcal;
  if (over > 25) {
    const protein = (name: string) => findFood(name)?.group === "Protein" && !/biltong/i.test(name);
    const proteinKcal = fitted.meals.flatMap((m) => m.items).reduce((t, i) => t + (protein(i.food) ? itemTotals(i).kcal : 0), 0);
    if (proteinKcal > 0) fitted = scale(fitted, protein, Math.max(0.8, (proteinKcal - over) / proteinKcal));
  }
  return fitted;
}

// Every matching food times `factor`, to the nearest 5 g.
function scale(day: DietDay, matches: (name: string) => boolean, factor: number): DietDay {
  return {
    meals: day.meals.map((m) => ({
      ...m,
      items: m.items
        .map((it) => (matches(it.food) ? { ...it, grams: Math.round((it.grams * factor) / 5) * 5 } : it))
        .filter((it) => it.grams >= 5),
    })),
  };
}

function trimFats(day: DietDay, kcal: number): DietDay {
  let over = kcalOf(day) - kcal - 25;
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
export function swapOptions(foodName: string, diet: MealDiet = "everything", dairyFree = false): Food[] {
  const food = findFood(foodName);
  if (!food) return [];
  return FOODS.filter((f) => f.group === food.group && f.name !== food.name && foodAllowed(f.name, diet, dairyFree));
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
