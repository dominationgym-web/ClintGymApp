// Foods for the meal builder in the Nutrition section. Values are per 100 g
// (per 100 ml for milk), rounded from standard food tables, and labelled
// cooked or raw where it matters. Never add oats (the coach's rule).

export type FoodGroup = "Protein" | "Carbs" | "Veg" | "Fats" | "Fruit & dairy";

export type FoodUnit = { label: string; grams: number };

export type Food = {
  name: string;
  group: FoodGroup;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  // Handy measures besides grams, e.g. teaspoons of oil or whole eggs.
  units?: FoodUnit[];
  // The amount filled in when the food is added, in its first unit.
  usual: number;
};

export const FOOD_GROUPS: FoodGroup[] = ["Protein", "Carbs", "Veg", "Fats", "Fruit & dairy"];

const TSP_OIL = { label: "tsp", grams: 4.5 };
const TBSP_OIL = { label: "tbsp", grams: 13.5 };

export const FOODS: Food[] = [
  // Protein
  { name: "Chicken breast (cooked)", group: "Protein", kcal: 165, protein: 31, carbs: 0, fat: 3.6, usual: 150 },
  { name: "Chicken breast (raw)", group: "Protein", kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, usual: 150 },
  { name: "Chicken thigh, no skin (cooked)", group: "Protein", kcal: 209, protein: 26, carbs: 0, fat: 10.9, usual: 150 },
  { name: "Lean beef mince (cooked)", group: "Protein", kcal: 217, protein: 26, carbs: 0, fat: 12, usual: 150 },
  { name: "Beef steak (cooked)", group: "Protein", kcal: 190, protein: 30, carbs: 0, fat: 7.5, usual: 150 },
  { name: "Ostrich steak (cooked)", group: "Protein", kcal: 145, protein: 29, carbs: 0, fat: 2.5, usual: 150 },
  { name: "Pork chop, lean (cooked)", group: "Protein", kcal: 196, protein: 29, carbs: 0, fat: 8, usual: 150 },
  { name: "Lamb chop (cooked)", group: "Protein", kcal: 294, protein: 25, carbs: 0, fat: 21, usual: 120 },
  { name: "Salmon (cooked)", group: "Protein", kcal: 206, protein: 22, carbs: 0, fat: 12, usual: 150 },
  { name: "Hake / white fish (cooked)", group: "Protein", kcal: 105, protein: 23, carbs: 0, fat: 1, usual: 150 },
  { name: "Tuna in water (drained)", group: "Protein", kcal: 116, protein: 26, carbs: 0, fat: 0.8, usual: 120 },
  {
    name: "Eggs",
    group: "Protein",
    kcal: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    units: [{ label: "egg", grams: 50 }],
    usual: 2,
  },
  { name: "Egg whites", group: "Protein", kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, usual: 100 },
  { name: "Biltong", group: "Protein", kcal: 290, protein: 55, carbs: 2, fat: 6, usual: 50 },
  {
    name: "Whey protein powder",
    group: "Protein",
    kcal: 400,
    protein: 78,
    carbs: 8,
    fat: 6,
    units: [{ label: "scoop", grams: 30 }],
    usual: 1,
  },
  { name: "Tofu, firm", group: "Protein", kcal: 144, protein: 16, carbs: 3, fat: 8.7, usual: 150 },

  // Carbs
  { name: "Potatoes (boiled)", group: "Carbs", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, usual: 200 },
  { name: "Sweet potato (cooked)", group: "Carbs", kcal: 90, protein: 2, carbs: 20.7, fat: 0.2, usual: 150 },
  { name: "White rice (cooked)", group: "Carbs", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, usual: 150 },
  { name: "Brown rice (cooked)", group: "Carbs", kcal: 123, protein: 2.7, carbs: 25.6, fat: 1, usual: 150 },
  { name: "Pasta (cooked)", group: "Carbs", kcal: 158, protein: 5.8, carbs: 31, fat: 0.9, usual: 150 },
  { name: "Lentils (cooked)", group: "Carbs", kcal: 116, protein: 9, carbs: 20, fat: 0.4, usual: 100 },
  { name: "Lentils (dry)", group: "Carbs", kcal: 352, protein: 24.6, carbs: 63, fat: 1.1, usual: 20 },
  { name: "Chickpeas (cooked)", group: "Carbs", kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6, usual: 100 },
  { name: "Kidney beans (cooked)", group: "Carbs", kcal: 127, protein: 8.7, carbs: 22.8, fat: 0.5, usual: 100 },
  { name: "Quinoa (cooked)", group: "Carbs", kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, usual: 150 },
  { name: "Pap / maize porridge (cooked)", group: "Carbs", kcal: 72, protein: 1.7, carbs: 15.5, fat: 0.3, usual: 200 },
  {
    name: "Brown bread",
    group: "Carbs",
    kcal: 247,
    protein: 13,
    carbs: 41,
    fat: 3.4,
    units: [{ label: "slice", grams: 35 }],
    usual: 2,
  },

  // Veg
  { name: "Broccoli", group: "Veg", kcal: 35, protein: 2.4, carbs: 7.2, fat: 0.4, usual: 100 },
  { name: "Spinach", group: "Veg", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, usual: 80 },
  { name: "Green beans", group: "Veg", kcal: 31, protein: 1.8, carbs: 7, fat: 0.2, usual: 100 },
  { name: "Carrots", group: "Veg", kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, usual: 80 },
  { name: "Butternut", group: "Veg", kcal: 45, protein: 1, carbs: 11.7, fat: 0.1, usual: 150 },
  { name: "Tomato", group: "Veg", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, usual: 100 },
  { name: "Mixed salad leaves", group: "Veg", kcal: 17, protein: 1.2, carbs: 3.3, fat: 0.2, usual: 80 },

  // Fats
  { name: "Olive oil", group: "Fats", kcal: 884, protein: 0, carbs: 0, fat: 100, units: [TSP_OIL, TBSP_OIL], usual: 2 },
  { name: "Coconut oil", group: "Fats", kcal: 862, protein: 0, carbs: 0, fat: 100, units: [TSP_OIL, TBSP_OIL], usual: 1 },
  {
    name: "Butter",
    group: "Fats",
    kcal: 717,
    protein: 0.9,
    carbs: 0.1,
    fat: 81,
    units: [{ label: "tsp", grams: 5 }],
    usual: 1,
  },
  { name: "Avocado", group: "Fats", kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, usual: 50 },
  {
    name: "Peanut butter",
    group: "Fats",
    kcal: 588,
    protein: 25,
    carbs: 20,
    fat: 50,
    units: [{ label: "tbsp", grams: 16 }],
    usual: 1,
  },
  { name: "Almonds", group: "Fats", kcal: 579, protein: 21, carbs: 21.6, fat: 49.9, usual: 30 },
  { name: "Cheddar cheese", group: "Fats", kcal: 403, protein: 25, carbs: 1.3, fat: 33, usual: 30 },
  { name: "Feta", group: "Fats", kcal: 264, protein: 14, carbs: 4, fat: 21, usual: 30 },

  // Fruit & dairy
  { name: "Banana", group: "Fruit & dairy", kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, usual: 120 },
  { name: "Apple", group: "Fruit & dairy", kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, usual: 150 },
  { name: "Berries", group: "Fruit & dairy", kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, usual: 100 },
  { name: "Greek yoghurt, plain", group: "Fruit & dairy", kcal: 97, protein: 9, carbs: 4, fat: 5, usual: 150 },
  { name: "Cottage cheese, low fat", group: "Fruit & dairy", kcal: 82, protein: 11, carbs: 3.4, fat: 2.3, usual: 100 },
  { name: "Full cream milk (ml)", group: "Fruit & dairy", kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, usual: 250 },
  { name: "Low fat milk (ml)", group: "Fruit & dairy", kcal: 50, protein: 3.3, carbs: 4.8, fat: 2, usual: 250 },
];

/** The measures a food can be entered in: its own units first, then grams. */
export function foodUnits(food: Food): FoodUnit[] {
  return [...(food.units ?? []), { label: food.name.endsWith("(ml)") ? "ml" : "g", grams: 1 }];
}

export type MealItem = { food: Food; amount: number; unit: FoodUnit };

export type Totals = { kcal: number; protein: number; carbs: number; fat: number };

/** What one item adds to the meal, unrounded. */
export function itemTotals({ food, amount, unit }: MealItem): Totals {
  const factor = (amount * unit.grams) / 100;
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

/** The whole meal, rounded: calories to whole kcal, macros to whole grams. */
export function mealTotals(items: MealItem[]): Totals {
  const sum = items.map(itemTotals).reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: Math.round(sum.kcal),
    protein: Math.round(sum.protein),
    carbs: Math.round(sum.carbs),
    fat: Math.round(sum.fat),
  };
}
