import { describe, expect, it } from "vitest";
import { FOODS } from "./foods";
import { macroTargets, makeDay, type MealPlanSettings } from "./mealPlanMaker";
import { emailShareLink, packsFor, shoppingList, shoppingListText, weekGrams, weightLabel, whatsappShareLink } from "./shoppingList";

const settings: MealPlanSettings = { meals: ["07:00", "12:00", "16:00", "19:00"], training: "17:30", goal: "maintain", diet: "everything" };
const targets = macroTargets(2400, 80);
const training = makeDay(settings, targets, true, 0);
const rest = makeDay(settings, targets, false, 0);

describe("weekGrams", () => {
  it("adds up the training days and the rest days", () => {
    const one = { meals: [{ name: "A", items: [{ food: "Banana", grams: 120 }] }] };
    const two = { meals: [{ name: "B", items: [{ food: "Banana", grams: 240 }] }] };
    expect(weekGrams(one, two, 3).get("Banana")).toBe(3 * 120 + 4 * 240);
    expect(weekGrams(one, two, 0).get("Banana")).toBe(7 * 240);
  });
});

describe("packsFor", () => {
  it("takes the smallest pack that covers it", () => {
    expect(packsFor(820, [500, 1000, 2000])).toEqual([[1000, 1]]);
    expect(packsFor(2300, [500, 1000, 2000])).toEqual([[2000, 1], [500, 1]]);
    expect(packsFor(14, [6, 12, 18, 30])).toEqual([[18, 1]]);
  });
});

describe("weightLabel", () => {
  it("reads like a shop label", () => {
    expect(weightLabel(750)).toBe("750 g");
    expect(weightLabel(1500)).toBe("1.5 kg");
    expect(weightLabel(2000, true)).toBe("2 L");
  });
});

describe("shoppingList", () => {
  it("turns cooked food into what you buy", () => {
    const day = { meals: [{ name: "Lunch", items: [{ food: "White rice (cooked)", grams: 200 }, { food: "Chicken breast (cooked)", grams: 150 }, { food: "Eggs", grams: 100 }] }] };
    const list = shoppingList(day, day, 4);
    const items = list.sections.flatMap((s) => s.items);
    const rice = items.find((i) => i.name === "White rice (uncooked)");
    expect(rice?.need).toBe("About 510 g");
    expect(rice?.buy).toBe("1 × 500 g bag");
    expect(items.find((i) => i.name.startsWith("Chicken breast"))?.need).toBe("About 1.4 kg");
    expect(items.find((i) => i.name === "Eggs")).toMatchObject({ need: "14 eggs", buy: "1 × box of 18" });
  });

  it("counts tins and loaves", () => {
    const day = { meals: [{ name: "Lunch", items: [{ food: "Chickpeas (cooked)", grams: 100 }, { food: "Brown bread", grams: 70 }] }] };
    const items = shoppingList(day, day, 3).sections.flatMap((s) => s.items);
    expect(items.find((i) => i.name === "Chickpeas")?.need).toBe("3 tins (400 g)");
    expect(items.find((i) => i.name === "Brown bread")).toMatchObject({ need: "14 slices", buy: "1 × loaf (20 slices)" });
  });

  it("puts both kinds of pap together as maize meal", () => {
    const day = { meals: [{ name: "Dinner", items: [{ food: "Stiff pap (cooked)", grams: 200 }, { food: "Pap / maize porridge (cooked)", grams: 200 }] }] };
    const items = shoppingList(day, day, 2).sections.flatMap((s) => s.items);
    expect(items.filter((i) => i.name === "Maize meal")).toHaveLength(1);
    expect(items[0].from).toHaveLength(2);
  });

  it("has every food in a real plan, in a shop section, with no oats", () => {
    const list = shoppingList(training, rest, 4);
    const from = list.sections.flatMap((s) => s.items.flatMap((i) => i.from));
    const planned = new Set([...training.meals, ...rest.meals].flatMap((m) => m.items.map((i) => i.food)));
    expect(new Set(from)).toEqual(planned);
    expect(shoppingListText(list).toLowerCase()).not.toContain("oat");
    expect(list.trainingDays + list.restDays).toBe(7);
  });

  it("includes the client's own meal, oats too when they picked them", () => {
    const own: MealPlanSettings = { ...settings, ownMeals: { "0": [{ food: "Oats, rolled or steel-cut (dry)", grams: 50 }, { food: "Banana", grams: 120 }] } };
    const list = shoppingList(makeDay(own, targets, true), makeDay(own, targets, false), 3);
    const oats = list.sections.flatMap((s) => s.items).find((i) => i.name.startsWith("Oats"));
    expect(oats?.need).toBe("About 350 g");
  });

  it("knows how to buy every food in the food list", () => {
    for (const f of FOODS) {
      const day = { meals: [{ name: "M", items: [{ food: f.name, grams: f.units ? f.units[0].grams * f.usual : f.usual }] }] };
      const [item] = shoppingList(day, day, 3).sections.flatMap((s) => s.items);
      expect(item.need, f.name).toMatch(/\d/);
    }
  });
});

describe("packsFor slack", () => {
  it("doesn't add a pack for the last few grams", () => {
    expect(packsFor(2010, [500, 1000])).toEqual([[1000, 2]]);
    expect(packsFor(1040, [250, 500, 1000])).toEqual([[1000, 1]]);
    expect(packsFor(7, [6, 12])).toEqual([[12, 1]]);
  });
});

describe("packsFor two packs", () => {
  it("uses two smaller packs when they waste less", () => {
    expect(packsFor(600, [250, 500, 1000])).toEqual([[500, 1], [250, 1]]);
    expect(packsFor(1400, [250, 500, 1000])).toEqual([[1000, 1], [500, 1]]);
    expect(packsFor(480, [250, 500, 1000])).toEqual([[500, 1]]);
  });
});

describe("share links", () => {
  it("puts the whole list in a WhatsApp message and an email", () => {
    const text = "🛒 My list\n• Eggs: 1 × box of 12 & more";
    expect(whatsappShareLink(text)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
    expect(decodeURIComponent(whatsappShareLink(text).split("text=")[1])).toBe(text);
    const mail = emailShareLink(text);
    expect(mail.startsWith("mailto:?subject=My%20shopping%20list%20for%20the%20week&body=")).toBe(true);
    expect(decodeURIComponent(mail.split("body=")[1])).toBe(text);
  });
});
