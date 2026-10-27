import { findFood } from "@/lib/dietPlan";
import type { DietDay } from "@/types/database";

// The week's shopping list from the client's own meal plan (GRIZZ,
// 2026-10-27: "would you like me to put together a shopping list for the
// week?"). It adds up their training days and rest days for the week, turns
// cooked weights into what you buy (uncooked rice, raw chicken, tins of
// beans, loaves of bread) and rounds each one up to the packs shops sell.
// Their own meals are in the days, so their foods are on the list too. The
// list only has foods that are in the plan, so nothing is ever added to it.

export type ShopSection =
  | "Meat, chicken & fish"
  | "Eggs & dairy"
  | "Vegetables"
  | "Fruit"
  | "Bread, rice & starches"
  | "Tins, beans & lentils"
  | "Nuts, seeds & spreads"
  | "Oils & cupboard";

export const SHOP_SECTIONS: { section: ShopSection; icon: string }[] = [
  { section: "Meat, chicken & fish", icon: "🥩" },
  { section: "Eggs & dairy", icon: "🥚" },
  { section: "Vegetables", icon: "🥦" },
  { section: "Fruit", icon: "🍎" },
  { section: "Bread, rice & starches", icon: "🍞" },
  { section: "Tins, beans & lentils", icon: "🥫" },
  { section: "Nuts, seeds & spreads", icon: "🥜" },
  { section: "Oils & cupboard", icon: "🫒" },
];

/**
 * How a food is bought. `factor` turns a gram eaten into a gram bought (cooked
 * rice is about a third of its weight uncooked; cooked meat lost about a
 * quarter of its raw weight). `packs` are the sizes it's sold in, in grams
 * (ml for drinks), or in pieces when `piece` is given.
 */
type BuyRule = {
  match: RegExp;
  section: ShopSection;
  /** What to look for in the shop, when it isn't the food's own name. */
  buy?: string;
  factor?: number;
  /** Sold or counted one by one: the weight of one, and what one is called. */
  piece?: { grams: number; one: string; many: string };
  packs?: number[];
  /** What one pack is called: bag, tin, loaf. */
  pack?: string;
  /** What a pack of pieces holds, e.g. "slices" for "1 × loaf (20 slices)". */
  packOf?: string;
  /** Usually already in the cupboard and lasts more than a week. */
  check?: boolean;
};

const MEAT_PACKS = [250, 500, 1000];
const RAW_MEAT = 1.33;
const RAW_FISH = 1.25;
const BAG = [500, 1000, 2000];
const DRY_PACK = [250, 500, 1000];

const plural = (one: string, many?: string) => ({ one, many: many ?? `${one}s` });

// Checked in order: the first rule that matches the food's name is used.
const RULES: BuyRule[] = [
  // Meat, chicken and fish: raw weight, rounded up to the pack.
  { match: /^Chicken breast \(raw\)/, section: "Meat, chicken & fish", buy: "Chicken breast fillets", packs: MEAT_PACKS },
  { match: /^Chicken breast \(cooked\)/, section: "Meat, chicken & fish", buy: "Chicken breast fillets (raw)", factor: RAW_MEAT, packs: MEAT_PACKS },
  { match: /^Chicken thigh/, section: "Meat, chicken & fish", buy: "Chicken thighs, skinless (raw)", factor: RAW_MEAT, packs: MEAT_PACKS },
  { match: /^Chicken drumstick/, section: "Meat, chicken & fish", buy: "Chicken drumsticks (raw)", factor: RAW_MEAT, packs: MEAT_PACKS },
  { match: /^Chicken livers/, section: "Meat, chicken & fish", buy: "Chicken livers (raw)", factor: RAW_MEAT, packs: [250, 500] },
  { match: /^Lean beef mince/, section: "Meat, chicken & fish", buy: "Lean beef mince (raw)", factor: RAW_MEAT, packs: MEAT_PACKS },
  { match: /^Lean turkey mince/, section: "Meat, chicken & fish", buy: "Lean turkey mince (raw)", factor: RAW_MEAT, packs: MEAT_PACKS },
  { match: /^Biltong|^Droëwors/, section: "Meat, chicken & fish", packs: [100, 250, 500, 1000] },
  { match: /^Bacon/, section: "Meat, chicken & fish", buy: "Back bacon", factor: 1.4, packs: [200, 250, 500] },
  { match: /^Ham/, section: "Meat, chicken & fish", buy: "Lean sliced ham", packs: [125, 250, 500] },
  { match: /^Tuna in water/, section: "Meat, chicken & fish", buy: "Tuna in water", piece: { grams: 120, one: "tin (170 g)", many: "tins (170 g)" } },
  { match: /^Sardines/, section: "Meat, chicken & fish", buy: "Sardines in tomato sauce", piece: { grams: 120, one: "tin (120 g)", many: "tins (120 g)" } },
  { match: /^Pilchards/, section: "Meat, chicken & fish", buy: "Pilchards in tomato sauce", piece: { grams: 400, one: "tin (400 g)", many: "tins (400 g)" } },
  { match: /^Mackerel/, section: "Meat, chicken & fish", buy: "Tinned mackerel", piece: { grams: 300, one: "tin (425 g)", many: "tins (425 g)" } },
  { match: /salmon|hake|fish|snoek|kingklip|cod|tilapia|trout|prawn|mussel/i, section: "Meat, chicken & fish", factor: RAW_FISH, packs: [250, 400, 500, 1000] },

  // Eggs and dairy.
  { match: /^Eggs$/, section: "Eggs & dairy", piece: { grams: 50, ...plural("egg") }, packs: [6, 12, 18, 30], pack: "box" },
  { match: /^Egg whites/, section: "Eggs & dairy", buy: "Egg whites (carton)", packs: [500, 1000] },
  { match: /milk|Amasi|Kefir/, section: "Eggs & dairy", packs: [500, 1000, 2000], pack: "bottle" },
  { match: /yoghurt|Skyr/i, section: "Eggs & dairy", packs: [500, 1000], pack: "tub" },
  { match: /Cottage cheese|Quark|Ricotta/, section: "Eggs & dairy", packs: [250, 500], pack: "tub" },
  { match: /Cheddar|Feta|Mozzarella|Halloumi/, section: "Eggs & dairy", packs: [200, 400, 800] },
  { match: /Parmesan/, section: "Eggs & dairy", packs: [100, 200] },
  { match: /^Butter$|^Ghee/, section: "Eggs & dairy", packs: [250, 500], check: true },

  // Bread, rice and starches: uncooked weights.
  { match: /^Brown bread|^White bread/, section: "Bread, rice & starches", piece: { grams: 35, ...plural("slice") }, packs: [20], pack: "loaf", packOf: "slices" },
  { match: /^Rye bread/, section: "Bread, rice & starches", piece: { grams: 32, ...plural("slice") }, packs: [16], pack: "loaf", packOf: "slices" },
  { match: /^Sourdough/, section: "Bread, rice & starches", piece: { grams: 50, ...plural("slice") }, packs: [16], pack: "loaf", packOf: "slices" },
  { match: /^Wholewheat wrap/, section: "Bread, rice & starches", piece: { grams: 60, ...plural("wrap") }, packs: [6], pack: "pack" },
  { match: /^Wholewheat pita/, section: "Bread, rice & starches", piece: { grams: 64, ...plural("pita") }, packs: [6], pack: "pack" },
  { match: /^Bagel/, section: "Bread, rice & starches", piece: { grams: 95, ...plural("bagel") }, packs: [4], pack: "pack" },
  { match: /^Roti/, section: "Bread, rice & starches", piece: { grams: 70, ...plural("roti", "rotis") }, packs: [5, 10], pack: "pack" },
  { match: /^Corn tortilla/, section: "Bread, rice & starches", piece: { grams: 26, ...plural("tortilla") }, packs: [10], pack: "pack" },
  { match: /^Rice cakes/, section: "Bread, rice & starches", piece: { grams: 9, ...plural("rice cake") }, packs: [14], pack: "pack" },
  { match: /^Bran rusk/, section: "Bread, rice & starches", piece: { grams: 40, ...plural("rusk") }, packs: [12], pack: "box" },
  { match: /^White rice/, section: "Bread, rice & starches", buy: "White rice (uncooked)", factor: 0.36, packs: BAG, pack: "bag" },
  { match: /^Brown rice/, section: "Bread, rice & starches", buy: "Brown rice (uncooked)", factor: 0.33, packs: BAG, pack: "bag" },
  { match: /^Basmati rice/, section: "Bread, rice & starches", buy: "Basmati rice (uncooked)", factor: 0.35, packs: BAG, pack: "bag" },
  { match: /^Wholewheat pasta/, section: "Bread, rice & starches", buy: "Wholewheat pasta (uncooked)", factor: 0.43, packs: [500], pack: "packet" },
  { match: /^Pasta/, section: "Bread, rice & starches", buy: "Pasta (uncooked)", factor: 0.43, packs: [500], pack: "packet" },
  { match: /^Egg noodles/, section: "Bread, rice & starches", buy: "Egg noodles (uncooked)", factor: 0.36, packs: [250, 500], pack: "packet" },
  { match: /^Rice noodles/, section: "Bread, rice & starches", buy: "Rice noodles (uncooked)", factor: 0.3, packs: [250, 500], pack: "packet" },
  { match: /^Quinoa/, section: "Bread, rice & starches", buy: "Quinoa (uncooked)", factor: 0.33, packs: [250, 500], pack: "packet" },
  { match: /^Couscous/, section: "Bread, rice & starches", buy: "Couscous (uncooked)", factor: 0.3, packs: [250, 500], pack: "packet" },
  { match: /^Bulgur/, section: "Bread, rice & starches", buy: "Bulgur wheat (uncooked)", factor: 0.24, packs: [250, 500], pack: "packet" },
  { match: /^Pearl barley/, section: "Bread, rice & starches", buy: "Pearl barley (uncooked)", factor: 0.35, packs: [500], pack: "packet" },
  { match: /^Pap \/ maize porridge/, section: "Bread, rice & starches", buy: "Maize meal", factor: 0.2, packs: [1000, 2500, 5000], pack: "bag" },
  { match: /^Stiff pap/, section: "Bread, rice & starches", buy: "Maize meal", factor: 0.31, packs: [1000, 2500, 5000], pack: "bag" },
  { match: /^Maize meal/, section: "Bread, rice & starches", buy: "Maize meal", packs: [1000, 2500, 5000], pack: "bag" },
  { match: /^Mabele/, section: "Bread, rice & starches", buy: "Mabele / sorghum meal", factor: 0.24, packs: [500, 1000], pack: "bag" },
  { match: /^Samp and beans/, section: "Bread, rice & starches", buy: "Samp and beans (dry)", factor: 0.3, packs: [500, 1000], pack: "bag" },
  { match: /^Samp/, section: "Bread, rice & starches", buy: "Samp (dry)", factor: 0.25, packs: [500, 1000], pack: "bag" },
  // Only ever here when the client put oats in their own meal.
  { match: /^Oat porridge/, section: "Bread, rice & starches", buy: "Oats, rolled or steel-cut", factor: 0.19, packs: [500, 1000], pack: "bag" },
  { match: /^Oats/, section: "Bread, rice & starches", buy: "Oats, rolled or steel-cut", packs: [500, 1000], pack: "bag" },
  { match: /^Popcorn/, section: "Bread, rice & starches", buy: "Popcorn kernels", packs: [500], pack: "bag" },
  { match: /^Baby potatoes/, section: "Bread, rice & starches", buy: "Baby potatoes", packs: [1000], pack: "bag" },
  { match: /^Potatoes/, section: "Bread, rice & starches", buy: "Potatoes", packs: [1000, 2000, 3000], pack: "bag" },
  { match: /^Sweet potato/, section: "Bread, rice & starches", buy: "Sweet potatoes", packs: [500, 1000] },
  { match: /^Corn on the cob/, section: "Bread, rice & starches", buy: "Corn on the cob (mielies)", piece: { grams: 150, ...plural("cob") } },
  { match: /^Plantain/, section: "Bread, rice & starches", piece: { grams: 200, ...plural("plantain") } },

  // Tins, beans and lentils: a 400 g tin drains to about 240 g.
  { match: /^Baked beans/, section: "Tins, beans & lentils", buy: "Baked beans", piece: { grams: 410, one: "tin (410 g)", many: "tins (410 g)" } },
  { match: /^Chakalaka/, section: "Tins, beans & lentils", piece: { grams: 410, one: "tin (410 g)", many: "tins (410 g)" } },
  { match: /^Lentils \(dry\)/, section: "Tins, beans & lentils", buy: "Lentils (dry)", packs: [500, 1000], pack: "bag" },
  { match: /^Split peas/, section: "Tins, beans & lentils", buy: "Split peas (dry)", factor: 0.35, packs: [500], pack: "bag" },
  { match: /^(Lentils|Chickpeas|Kidney beans|Sugar beans|Black beans|Butter beans|Cannellini beans) \(cooked\)/, section: "Tins, beans & lentils", piece: { grams: 240, one: "tin (400 g)", many: "tins (400 g)" } },
  { match: /^Tofu/, section: "Tins, beans & lentils", buy: "Firm tofu", packs: [300], pack: "block" },
  { match: /^Tempeh/, section: "Tins, beans & lentils", packs: [200], pack: "block" },
  { match: /^Edamame/, section: "Vegetables", buy: "Edamame beans (frozen)", packs: [500], pack: "bag" },
  { match: /^Green peas/, section: "Vegetables", buy: "Peas (frozen)", packs: [500, 1000], pack: "bag" },

  // Vegetables, by the piece where they're sold that way.
  { match: /^Broccoli/, section: "Vegetables", piece: { grams: 350, ...plural("head") } },
  { match: /^Cauliflower/, section: "Vegetables", piece: { grams: 600, ...plural("head") } },
  { match: /^Cabbage/, section: "Vegetables", piece: { grams: 1000, ...plural("head") } },
  { match: /^Butternut/, section: "Vegetables", piece: { grams: 900, ...plural("butternut") } },
  { match: /^Tomato/, section: "Vegetables", buy: "Tomatoes", piece: { grams: 120, one: "tomato", many: "tomatoes" } },
  { match: /^Onion/, section: "Vegetables", buy: "Onions", piece: { grams: 150, ...plural("onion") } },
  { match: /^Peppers/, section: "Vegetables", piece: { grams: 150, ...plural("pepper") } },
  { match: /^Cucumber/, section: "Vegetables", piece: { grams: 300, ...plural("cucumber") } },
  { match: /^Brinjal/, section: "Vegetables", piece: { grams: 300, ...plural("brinjal") } },
  { match: /^Gem squash/, section: "Vegetables", piece: { grams: 250, ...plural("gem squash", "gem squash") } },
  { match: /^Avocado$/, section: "Vegetables", buy: "Avocados", piece: { grams: 150, ...plural("avocado") } },
  { match: /^Celery/, section: "Vegetables", piece: { grams: 400, one: "bunch", many: "bunches" } },
  { match: /^Mixed salad leaves/, section: "Vegetables", packs: [100, 150, 250], pack: "bag" },
  { match: /^Spinach|^Kale|^Morogo/, section: "Vegetables", packs: [200, 250, 500], pack: "bag" },
  { match: /^Mushrooms/, section: "Vegetables", packs: [250, 500], pack: "punnet" },
  { match: /^Carrots/, section: "Vegetables", packs: [500, 1000], pack: "bag" },
  { match: /^Pumpkin \(/, section: "Vegetables", packs: [500, 1000] },

  // Fruit, by the piece or the punnet.
  { match: /^Banana/, section: "Fruit", buy: "Bananas", piece: { grams: 120, ...plural("banana") } },
  { match: /^Apple/, section: "Fruit", buy: "Apples", piece: { grams: 150, ...plural("apple") } },
  { match: /^Pear/, section: "Fruit", buy: "Pears", piece: { grams: 170, ...plural("pear") } },
  { match: /^Orange/, section: "Fruit", buy: "Oranges", piece: { grams: 130, ...plural("orange") } },
  { match: /^Naartjie/, section: "Fruit", buy: "Naartjies", piece: { grams: 80, ...plural("naartjie") } },
  { match: /^Mango/, section: "Fruit", buy: "Mangoes", piece: { grams: 200, one: "mango", many: "mangoes" } },
  { match: /^Kiwi/, section: "Fruit", buy: "Kiwi fruit", piece: { grams: 75, ...plural("kiwi") } },
  { match: /^Peach/, section: "Fruit", buy: "Peaches or nectarines", piece: { grams: 150, one: "peach", many: "peaches" } },
  { match: /^Plum/, section: "Fruit", buy: "Plums", piece: { grams: 70, ...plural("plum") } },
  { match: /^Guava/, section: "Fruit", buy: "Guavas", piece: { grams: 100, ...plural("guava") } },
  { match: /^Pineapple/, section: "Fruit", piece: { grams: 600, ...plural("pineapple") } },
  { match: /^Pawpaw/, section: "Fruit", piece: { grams: 600, ...plural("pawpaw") } },
  { match: /^Watermelon/, section: "Fruit", buy: "Watermelon", piece: { grams: 2500, one: "small watermelon", many: "small watermelons" } },
  { match: /^Spanspek/, section: "Fruit", piece: { grams: 700, ...plural("spanspek") } },
  { match: /^Granadilla/, section: "Fruit", buy: "Granadillas", piece: { grams: 18, ...plural("granadilla") } },
  { match: /^Strawberries/, section: "Fruit", packs: [250, 500], pack: "punnet" },
  { match: /^Blueberries|^Raspberries/, section: "Fruit", packs: [125, 250, 500], pack: "punnet" },
  { match: /^Berries/, section: "Fruit", buy: "Mixed berries (frozen)", packs: [500, 1000], pack: "bag" },
  { match: /^Grapes|^Litchis/, section: "Fruit", packs: [500, 1000] },
  { match: /^Dates|^Raisins|^Prunes/, section: "Fruit", packs: [250, 500], pack: "packet" },

  // Nuts, seeds and spreads.
  { match: /butter$|^Tahini/, section: "Nuts, seeds & spreads", packs: [250, 400, 800], pack: "jar", check: true },
  { match: /^Hummus/, section: "Nuts, seeds & spreads", packs: [200, 400], pack: "tub" },
  { match: /^Olives/, section: "Nuts, seeds & spreads", packs: [250, 500], pack: "jar" },
  { match: /^Chia|^Flaxseed|^Psyllium/, section: "Nuts, seeds & spreads", packs: [150, 250, 500], pack: "packet", check: true },
  { match: /nuts|Almonds|Walnuts|Cashews|Pistachios|seeds/i, section: "Nuts, seeds & spreads", packs: [100, 200, 400, 1000], pack: "packet" },

  // Cupboard things that last more than a week.
  // Oil is weighed in the plan; a gram is about 1.1 ml.
  { match: /oil$/, section: "Oils & cupboard", factor: 1.1, packs: [250, 500, 750], pack: "bottle", check: true },
  { match: /protein powder/, section: "Oils & cupboard", piece: { grams: 30, ...plural("scoop") }, check: true },
];

const GROUP_SECTION: Record<string, ShopSection> = {
  Protein: "Meat, chicken & fish",
  Carbs: "Bread, rice & starches",
  Fibre: "Tins, beans & lentils",
  Veg: "Vegetables",
  Fats: "Nuts, seeds & spreads",
  "Fruit & dairy": "Fruit",
};

export type ShopItem = {
  /** What to look for in the shop. */
  name: string;
  section: ShopSection;
  /** What the week's meals use, e.g. "About 820 g uncooked". */
  need: string;
  /** What to pick up, e.g. "1 × 1 kg bag", or null when `need` says it all. */
  buy: string | null;
  /** Usually in the cupboard already: check before buying. */
  check: boolean;
  /** The foods in the plan this comes from, e.g. both kinds of pap. */
  from: string[];
};

export type ShoppingList = {
  trainingDays: number;
  restDays: number;
  sections: { section: ShopSection; icon: string; items: ShopItem[] }[];
};

const ruleFor = (name: string): BuyRule => {
  const rule = RULES.find((r) => r.match.test(name));
  if (rule) return rule;
  const food = findFood(name);
  // Other meat: bought raw, and cooking takes off about a quarter.
  if (food?.group === "Protein" && /\((cooked|roasted)\)/.test(name)) return { match: /.*/, section: "Meat, chicken & fish", factor: RAW_MEAT, packs: MEAT_PACKS };
  return { match: /.*/, section: food ? GROUP_SECTION[food.group] ?? "Oils & cupboard" : "Oils & cupboard", packs: [250, 500, 1000] };
};

const isMl = (name: string) => /\(ml\)/.test(name) || /milk|Amasi|Kefir|Egg whites|oil$/.test(name);

/** "750 g", "1.5 kg", "2 L". */
export function weightLabel(amount: number, ml = false): string {
  const [small, big] = ml ? ["ml", "L"] : ["g", "kg"];
  if (amount < 1000) return `${amount} ${small}`;
  return `${Math.round((amount / 1000) * 10) / 10} ${big}`;
}

/**
 * The packs to buy for `need`: the biggest pack while more than one is still
 * needed, then the fewest grams of one or two packs that cover what's left. A last few grams
 * (under 5%) don't need another pack. Returns [size, count] pairs, biggest
 * first.
 */
export function packsFor(need: number, sizes: number[]): [number, number][] {
  const sorted = [...sizes].sort((a, b) => a - b);
  const biggest = sorted[sorted.length - 1];
  const out = new Map<number, number>();
  const slack = need * 0.05;
  let left = need;
  while (left > biggest + slack) {
    out.set(biggest, (out.get(biggest) ?? 0) + 1);
    left -= biggest;
  }
  if (left > slack) {
    // One pack, or two smaller ones when they waste less (750 g as 500 g + 250 g, not 1 kg).
    const options: number[][] = sorted.map((a) => [a]);
    for (const a of sorted) for (const b of sorted) if (b <= a) options.push([a, b]);
    const fits = options.filter((o) => o.reduce((x, y) => x + y, 0) + slack >= left);
    const total = (o: number[]) => o.reduce((x, y) => x + y, 0);
    const best = fits.sort((x, y) => total(x) - total(y) || x.length - y.length)[0] ?? [biggest];
    for (const size of best) out.set(size, (out.get(size) ?? 0) + 1);
  }
  return [...out.entries()].sort((a, b) => b[0] - a[0]);
}

const nameOf = (food: string) => food.replace(/\s*\((ml|raw|cooked|boiled|drained|roasted|grilled)\)$/i, "");

/** Every food in the week, in grams (ml for drinks): training days plus rest days. */
export function weekGrams(trainingDay: DietDay, restDay: DietDay, trainingDays: number): Map<string, number> {
  const days = Math.max(0, Math.min(7, Math.round(trainingDays)));
  const totals = new Map<string, number>();
  const add = (day: DietDay, times: number) => {
    if (times <= 0) return;
    for (const meal of day.meals) for (const item of meal.items) {
      if (!(item.grams > 0)) continue;
      totals.set(item.food, (totals.get(item.food) ?? 0) + item.grams * times);
    }
  };
  add(trainingDay, days);
  add(restDay, 7 - days);
  return totals;
}

/**
 * The client's shopping list for a week of their plan: `trainingDays` of
 * the training-day plan and the rest of the week of the rest-day plan.
 */
export function shoppingList(trainingDay: DietDay, restDay: DietDay, trainingDays: number): ShoppingList {
  const days = Math.max(0, Math.min(7, Math.round(trainingDays)));
  // Foods bought as the same thing (both kinds of pap are maize meal) are added up first.
  const bought = new Map<string, { rule: BuyRule; amount: number; from: string[]; ml: boolean }>();
  for (const [food, grams] of weekGrams(trainingDay, restDay, days)) {
    const rule = ruleFor(food);
    const name = rule.buy ?? nameOf(food);
    const entry = bought.get(name) ?? { rule, amount: 0, from: [], ml: isMl(food) };
    entry.amount += grams * (rule.factor ?? 1);
    entry.from.push(food);
    bought.set(name, entry);
  }

  const items: ShopItem[] = [];
  for (const [name, { rule, amount, from, ml }] of bought) {
    let need: string;
    let buy: string | null = null;
    if (rule.piece) {
      const count = Math.max(1, Math.ceil(amount / rule.piece.grams - 0.15));
      need = `${count} ${count === 1 ? rule.piece.one : rule.piece.many}`;
      if (rule.packs) {
        buy = packsFor(count, rule.packs)
          .map(([size, n]) => (rule.packOf ? `${n} × ${rule.pack ?? "pack"} (${size} ${rule.packOf})` : `${n} × ${rule.pack ?? "pack"} of ${size}`))
          .join(" + ");
      }
    } else {
      // Weights to the nearest 10 g, and never under 10 g.
      const rounded = Math.max(10, Math.ceil(amount / 10) * 10);
      const what = rule.factor && rule.factor < 1 ? " uncooked" : rule.factor && rule.factor > 1 && !ml ? " raw" : "";
      need = `About ${weightLabel(rounded, ml)}${/uncooked|raw|dry|\(/i.test(name) ? "" : what}`;
      if (rule.packs) {
        const packs = packsFor(rounded, rule.packs);
        buy = packs.map(([size, n]) => `${n} × ${weightLabel(size, ml)}${rule.pack ? ` ${rule.pack}` : ""}`).join(" + ");
      }
    }
    items.push({ name, section: rule.section, need, buy, check: !!rule.check, from });
  }

  const sections = SHOP_SECTIONS.map(({ section, icon }) => ({
    section,
    icon,
    items: items.filter((i) => i.section === section).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((s) => s.items.length > 0);
  return { trainingDays: days, restDays: 7 - days, sections };
}

/** A guess at their training days from how active they said they are. */
export function trainingDaysGuess(activity: string | null | undefined): number {
  if (activity === "Very active") return 5;
  if (activity === "Active") return 4;
  if (activity === "Light") return 2;
  if (activity === "Inactive") return 1;
  return 3;
}

/** The list as plain text, for sending to themselves or whoever does the shopping. */
export function shoppingListText(list: ShoppingList): string {
  const lines = [
    `🛒 My shopping list for the week (${list.trainingDays} training ${list.trainingDays === 1 ? "day" : "days"}, ${list.restDays} rest ${list.restDays === 1 ? "day" : "days"})`,
  ];
  for (const s of list.sections) {
    lines.push("", `${s.icon} ${s.section}`);
    for (const i of s.items) lines.push(`• ${i.name}: ${i.buy ?? i.need}${i.check ? " (check the cupboard first)" : ""}`);
  }
  return lines.join("\n");
}
