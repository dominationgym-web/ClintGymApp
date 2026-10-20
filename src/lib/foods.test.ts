import { describe, expect, it } from "vitest";
import { FOODS, FOOD_GROUPS, foodUnits, mealTotals, searchFoods, type MealItem } from "./foods";
import { foodAllowed } from "./mealPlanMaker";

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

  it("has lean biltong from wet to dry, with more protein the drier it is", () => {
    const [wet, medium, dry] = ["wet", "medium", "dry"].map((k) => food(`Biltong, lean, ${k}`));
    expect([wet.protein, medium.protein, dry.protein]).toEqual([35, 50, 70]);
    expect(mealTotals([item("Biltong, lean, dry", 1, "handful")]).protein).toBe(21);
  });

  it("is zero for an empty meal", () => {
    expect(mealTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("puts every food in a known group and never lists oats", () => {
    for (const f of FOODS) expect(FOOD_GROUPS).toContain(f.group);
    expect(JSON.stringify(FOODS).toLowerCase()).not.toMatch(/\boats?\b/);
  });

  it("has one entry per name, with calories that match the macros", () => {
    expect(new Set(FOODS.map((f) => f.name)).size).toBe(FOODS.length);
    // Very high fibre foods (psyllium) carry fewer calories than their carbs suggest.
    for (const f of FOODS.filter((x) => (x.fibre ?? 0) < 20)) {
      const fromMacros = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
      expect(Math.abs(fromMacros - f.kcal), f.name).toBeLessThanOrEqual(Math.max(20, f.kcal * 0.12));
    }
  });
});

describe("finding foods", () => {
  const names = (text: string) => searchFoods(text).map((f) => f.name);

  it("finds foods by the names used in other countries", () => {
    expect(names("zucchini")).toEqual(["Baby marrow"]);
    expect(names("eggplant")).toEqual(["Brinjal / aubergine (cooked)"]);
    expect(names("ugali")).toEqual(["Stiff pap (cooked)"]);
    expect(names("shrimp")).toEqual(["Prawns (cooked)"]);
  });

  it("needs every word typed and ignores case", () => {
    expect(names("WHITE fish")).toEqual(expect.arrayContaining(["Hake / white fish (cooked)", "Cod (cooked)", "Kingklip (cooked)"]));
    expect(names("white fish")).not.toContain("Salmon (cooked)");
    expect(names("  ")).toEqual([]);
  });

  it("has South African favourites", () => {
    for (const n of ["Boerewors (cooked)", "Samp (cooked)", "Snoek (cooked)", "Chakalaka", "Amasi / maas (ml)", "Morogo (cooked)", "Gem squash (cooked)"])
      expect(food(n).name).toBe(n);
  });

  it("keeps new meat, fish and dairy away from clients who don't eat them", () => {
    expect(foodAllowed("Boerewors (cooked)", "vegetarian")).toBe(false);
    expect(foodAllowed("Ham, lean", "pescatarian")).toBe(false);
    expect(foodAllowed("Snoek (cooked)", "pescatarian")).toBe(true);
    expect(foodAllowed("Snoek (cooked)", "vegetarian")).toBe(false);
    expect(foodAllowed("Halloumi", "everything", true)).toBe(false);
    expect(foodAllowed("Amasi / maas (ml)", "everything", true)).toBe(false);
    expect(foodAllowed("Soy milk, unsweetened (ml)", "everything", true)).toBe(true);
    expect(foodAllowed("Peanut butter", "everything", true)).toBe(true);
    expect(foodAllowed("Butter", "everything", true)).toBe(false);
    expect(foodAllowed("Tempeh", "vegetarian", true)).toBe(true);
  });
});
