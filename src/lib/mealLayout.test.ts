import { describe, expect, it } from "vitest";
import { emptyDay, type DietDay } from "./dietPlan";
import { DEFAULT_LAYOUT, dayLayout, foodsMoving, relayoutDay } from "./mealLayout";

const it1 = (food: string) => ({ food, grams: 100 });

describe("meal layout for the trainer's own diet (GRIZZ, 2026-11-02)", () => {
  it("old five-slot days read as 3 meals and 2 snacks", () => {
    expect(dayLayout(emptyDay())).toEqual(DEFAULT_LAYOUT);
  });

  it("two meals and one snack, in time order, keeping foods", () => {
    const old: DietDay = emptyDay();
    old.meals[0].items.push(it1("Eggs")); // Breakfast
    old.meals[1].items.push(it1("Apple")); // Morning snack
    old.meals[4].items.push(it1("Rice")); // Dinner
    const day = relayoutDay(old, { meals: ["10:00", "18:00"], snacks: ["14:00"] });
    expect(day.meals.map((m) => m.name)).toEqual(["10:00 · Mid-morning", "14:00 · Snack", "18:00 · Dinner"]);
    expect(day.meals[0].items.map((i) => i.food)).toEqual(["Eggs"]);
    expect(day.meals[1].items.map((i) => i.food)).toEqual(["Apple"]);
    // Dinner (third meal) is gone, so its rice moves into the last meal.
    expect(day.meals[2].items.map((i) => i.food)).toEqual(["Rice"]);
    expect(dayLayout(day)).toEqual({ meals: ["10:00", "18:00"], snacks: ["14:00"] });
  });

  it("no snacks: snack foods move into the last meal", () => {
    const old = emptyDay();
    old.meals[3].items.push(it1("Biltong"));
    expect(foodsMoving(old, { meals: ["08:00", "13:00", "19:00"], snacks: [] })).toBe(1);
    const day = relayoutDay(old, { meals: ["08:00", "13:00", "19:00"], snacks: [] });
    expect(day.meals).toHaveLength(3);
    expect(day.meals[2].items.map((i) => i.food)).toEqual(["Biltong"]);
  });
});
