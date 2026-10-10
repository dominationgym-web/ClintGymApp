import { describe, expect, it } from "vitest";
import { FOODS, FOOD_GROUPS, foodUnits, mealTotals, type MealItem } from "./foods";

const food = (name: string) => {
  const f = FOODS.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f;
};
const item = (name: string, amount: number, unitLabel?: string): MealItem => {
  const f = food(name);
  const unit = foodUnits(f).find((u) => u.label === (unitLabel ?? "g"))!;
  return { food: f, amount, unit };
};

describe("meal builder", () => {
  it("adds up the coach's example meal", () => {
    const totals = mealTotals([
      item("Chicken breast (cooked)", 150),
      item("Lentils (dry)", 20),
      item("Potatoes (boiled)", 200),
      item("Olive oil", 2, "tsp"),
    ]);
    // 247.5 + 70.4 + 174 + 79.6 kcal
    expect(totals).toEqual({ kcal: 571, protein: 55, carbs: 53, fat: 15 });
  });

  it("counts whole eggs and scoops by their weight", () => {
    expect(mealTotals([item("Eggs", 2, "egg")]).kcal).toBe(143);
    expect(mealTotals([item("Whey protein powder", 1, "scoop")]).protein).toBe(23);
  });

  it("is zero for an empty meal", () => {
    expect(mealTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("puts every food in a known group and never lists oats", () => {
    for (const f of FOODS) expect(FOOD_GROUPS).toContain(f.group);
    expect(JSON.stringify(FOODS).toLowerCase()).not.toMatch(/\boats?\b/);
  });
});
