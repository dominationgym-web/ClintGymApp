import { describe, expect, it } from "vitest";
import { dayTotals } from "@/lib/dietPlan";
import { macroTargets, makeDay, type MealPlanSettings } from "@/lib/mealPlanMaker";
import {
  defaultTrainDays,
  EMPTY_TASTE,
  learnedDislikes,
  learnedLikes,
  makeWeek,
  tasteLeaveOut,
  tasteNote,
  tasteOwnMeal,
  tastePutBack,
  tasteSwap,
  weekIsOld,
  weekStart,
  weekdayOf,
} from "@/lib/mealWeek";
import { weekShoppingList } from "@/lib/shoppingList";

const settings: MealPlanSettings = { meals: ["07:00", "11:00", "16:00", "18:45"], training: "17:30", weekly: true, trainDays: [0, 2, 4] };
const targets = macroTargets(2000, 75, "maintain", 175);

describe("weekly meal plan", () => {
  it("makes seven days, on target, with different foods", () => {
    const week = makeWeek(settings, targets, 0, "2026-11-02");
    expect(week.days).toHaveLength(7);
    for (const day of week.days) expect(Math.abs(dayTotals(day).kcal - targets.kcal)).toBeLessThan(120);
    const foods = week.days.map((d) => d.meals.flatMap((m) => m.items.map((i) => i.food)).join("|"));
    expect(new Set(foods).size).toBeGreaterThan(4);
    // Monday trains: a pre-workout meal; Tuesday doesn't.
    expect(week.days[0].meals.some((m) => /Pre-workout/.test(m.name))).toBe(true);
    expect(week.days[1].meals.some((m) => /Pre-workout/.test(m.name))).toBe(false);
  });

  it("knows the week's Monday and when a week is old", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02");
    expect(weekdayOf("2026-11-08")).toBe(6);
    expect(weekIsOld({ startsOn: "2026-10-26", days: [] }, "2026-11-02")).toBe(true);
    expect(weekIsOld({ startsOn: "2026-11-02", days: [] }, "2026-11-08")).toBe(false);
  });

  it("guesses training days from the intake", () => {
    expect(defaultTrainDays([1, 3, 5])).toEqual([0, 2, 4]);
    expect(defaultTrainDays([], 3)).toEqual([0, 2, 4]);
  });

  it("adds up the shopping list from all seven days", () => {
    const week = makeWeek(settings, targets, 1, "2026-11-02");
    const list = weekShoppingList(week.days, 3);
    expect(list.sections.length).toBeGreaterThan(2);
  });
});

describe("learning what they like", () => {
  it("scores swaps, leave-outs, own meals and put-backs", () => {
    let t = tasteSwap(EMPTY_TASTE, "Hake / white fish (cooked)", "Chicken breast (cooked)");
    t = tasteSwap(t, "Salmon (cooked)", "Chicken breast (cooked)");
    t = tasteOwnMeal(t, ["Eggs", "Brown bread"]);
    t = tasteLeaveOut(t, "Lentils (cooked)");
    expect(learnedLikes(t)).toEqual(expect.arrayContaining(["Chicken breast (cooked)", "Eggs", "Brown bread"]));
    expect(learnedDislikes(t)).toEqual(["Lentils (cooked)"]);
    t = tastePutBack(t, "Lentils (cooked)");
    expect(learnedDislikes(t)).toEqual([]);
    expect(tasteNote(t, "Sarah")).toMatch(/Sarah often picks/);
  });

  it("uses liked foods more in new plans", () => {
    const plain = { ...settings, weekly: false };
    const liked = { ...plain, likes: ["Prawns (cooked)"] };
    const count = (s: MealPlanSettings) =>
      [0, 1, 2, 3, 4, 5, 6].reduce(
        (n, v) => n + makeDay(s, targets, false, v).meals.flatMap((m) => m.items).filter((i) => i.food === "Prawns (cooked)").length,
        0,
      );
    expect(count(liked)).toBeGreaterThan(count(plain));
  });

  it("never puts oats in a plan the client didn't choose", () => {
    const week = makeWeek(settings, targets, 3, "2026-11-02");
    expect(JSON.stringify(week)).not.toMatch(/oat/i);
  });
});
