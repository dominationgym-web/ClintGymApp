// Nutrition section: GRIZZ's hand-portion guideline (2026-10-10) and the
// optional calorie calculator.
import type { GuidelineGroup } from "@/lib/sleep";

export const NUTRITION_GUIDE: GuidelineGroup[] = [
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
