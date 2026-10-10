// Nutrition section: GRIZZ's hand-portion guideline (2026-10-10) and the
// optional calorie calculator.
import type { GuidelineGroup } from "@/lib/sleep";

export const NUTRITION_GUIDE: GuidelineGroup[] = [
  {
    heading: "Guidelines for your health, not your goals",
    points: [
      "These portions are for general, everyday eating. Your meals will change as your needs change.",
      "If you're trying to lose weight, there will be adjustments to these guidelines.",
      "If you're trying to gain weight, there will be adjustments too.",
      "If you're looking to improve your health and wellbeing, you might need to increase your healthy fat intake.",
      "So treat these as guidelines to support your health. Your coach will tailor them to your goals.",
    ],
  },
  {
    heading: "Your portions at each meal",
    points: [
      "Protein: 1–2 palm-sized portions.",
      "Carbohydrates: 1 cupped-hand portion, adjusted for activity and goals.",
      "Vegetables: 1–2 fists or more.",
      "Healthy fats: 1 small thumb-sized portion.",
      "Fruit: 1 medium piece or a small bowl of berries.",
    ],
  },
  {
    heading: "Carbs and water weight",
    points: [
      "Your body stores carbs in your muscles and liver as glycogen, and every gram of stored carbs holds about 3 grams of water with it.",
      "So 1 gram of carbs adds roughly 4 grams to the scale: the carb itself plus its water.",
      "That's why the scale can jump the day after a higher-carb meal. It's only water weight, not fat.",
      "It disappears again as you train and burn those carbs. Judge your progress over weeks, not one morning's weigh-in.",
    ],
  },
  {
    heading: "Good to know",
    points: [
      "All foods should be certified organic where available.",
      "Nutritional values are approximate. Meat and fish values refer to raw food, while grains and legumes are listed cooked unless specified otherwise.",
    ],
  },
];

// Energy per gram. Carbohydrate here is the figure on South African labels,
// which leaves fibre out; fibre is counted separately at about 2 kcal a gram.
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fibre: 2, fat: 9 } as const;

export type Macros = { protein: number; carbs: number; fibre: number; fat: number };
export type MacroKey = keyof Macros;

/** Turns what was typed ("25", "12,5", "") into grams; blank or invalid is 0. */
export function parseGrams(text: string): number {
  const n = Number(text.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Estimated calories for each nutrient and in total, rounded to whole kcal. */
export function estimateCalories(grams: Macros): { total: number; parts: Macros } {
  const parts = {
    protein: Math.round(grams.protein * KCAL_PER_GRAM.protein),
    carbs: Math.round(grams.carbs * KCAL_PER_GRAM.carbs),
    fibre: Math.round(grams.fibre * KCAL_PER_GRAM.fibre),
    fat: Math.round(grams.fat * KCAL_PER_GRAM.fat),
  };
  return { total: parts.protein + parts.carbs + parts.fibre + parts.fat, parts };
}

// Picture examples for each portion, shown above the guide.
export type FoodGroupExample = { title: string; portion: string; emojis: string; examples: string };

export const FOOD_GROUP_EXAMPLES: FoodGroupExample[] = [
  { title: "Protein", portion: "1–2 palms", emojis: "🍗 🐟 🥩 🥚", examples: "Chicken, fish, lean beef, eggs, ostrich, Greek yoghurt" },
  { title: "Carbohydrates", portion: "1 cupped hand", emojis: "🍠 🍚 🥔 🌽", examples: "Sweet potato, brown rice, potatoes, beans, lentils, quinoa" },
  { title: "Vegetables", portion: "1–2 fists or more", emojis: "🥦 🥬 🥕 🥒", examples: "Broccoli, spinach, carrots, peppers, green beans, cauliflower" },
  { title: "Healthy fats", portion: "1 thumb", emojis: "🥑 🥜 🌰", examples: "Avocado, olive oil, nuts, seeds, nut butter" },
  { title: "Fruit", portion: "1 piece or a small bowl of berries", emojis: "🍎 🍓 🍌 🍊", examples: "Apple, berries, banana, orange, pear" },
];
