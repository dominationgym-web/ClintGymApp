import { describe, expect, it } from "vitest";
import { eatenOn, mealKey, otherSourceTicks, tickFor, tickedSource, weekFoodTip, type MealTick } from "@/lib/mealTicks";

const tick = (ate_on: string, source: MealTick["source"], kcal: number, protein: number, i = 0): MealTick => ({
  ate_on,
  meal_key: mealKey(source, i, `Meal ${i}`),
  source,
  meal_name: `Meal ${i}`,
  kcal,
  protein,
  carbs: 10,
  fat: 5,
});

describe("meal ticks", () => {
  it("keys a meal by plan day, place and name", () => {
    expect(mealKey("training", 2, "16:00 · Pre-workout")).toBe("training:2:16:00 · Pre-workout");
    expect(mealKey("rest", 0, "x".repeat(300))).toHaveLength(160);
  });

  it("keeps the meal's numbers on the tick", () => {
    const t = tickFor("coach", 1, { name: "Lunch", items: [{ food: "Eggs", grams: 100 }] }, "2026-10-27");
    expect(t).toMatchObject({ ate_on: "2026-10-27", source: "coach", meal_name: "Lunch", meal_key: "coach:1:Lunch" });
    expect(t.kcal).toBeGreaterThan(100);
    expect(t.protein).toBeGreaterThan(10);
  });

  it("adds up a day and knows which plan day it came from", () => {
    const ticks = [tick("2026-10-27", "training", 500, 40, 0), tick("2026-10-27", "training", 300, 30, 1), tick("2026-10-26", "rest", 900, 60)];
    expect(eatenOn(ticks, "2026-10-27")).toEqual({ kcal: 800, protein: 70, carbs: 20, fat: 10 });
    expect(tickedSource(ticks, "2026-10-26")).toBe("rest");
    expect(tickedSource(ticks, "2026-10-25")).toBeNull();
    expect(otherSourceTicks(ticks, "2026-10-27", "rest")).toHaveLength(2);
    expect(otherSourceTicks(ticks, "2026-10-27", "training")).toHaveLength(0);
  });

  it("gives a tip about short protein, a good week, or unticked days", () => {
    const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"];
    const targets = { kcal: 2000, protein: 160 };
    const short = [tick("2026-10-26", "training", 1900, 100), tick("2026-10-27", "training", 1900, 110), tick("2026-10-28", "training", 2000, 170)];
    expect(weekFoodTip(short, days, targets, "2026-10-29")).toMatch(/Protein was short on 2 of 3 days/);
    const good = [tick("2026-10-26", "training", 1950, 160), tick("2026-10-27", "training", 2100, 165)];
    expect(weekFoodTip(good, days, targets, "2026-10-28")).toMatch(/within 200 kcal/);
    expect(weekFoodTip([tick("2026-10-29", "rest", 500, 40)], days, targets, "2026-10-29")).toMatch(/3 days this week have no meals ticked/);
    expect(weekFoodTip([], days, targets, "2026-10-29")).toBeNull();
  });
});
