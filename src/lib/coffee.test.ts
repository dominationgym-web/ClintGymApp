import { describe, expect, it } from "vitest";
import { coffeeText, isLateCoffee } from "./coffee";

describe("coffee helpers", () => {
  it("marks a last cup at 14:00 or later as late", () => {
    expect(isLateCoffee({ coffee_cups: 2, coffee_last_time: "14:00:00" })).toBe(true);
    expect(isLateCoffee({ coffee_cups: 2, coffee_last_time: "13:59" })).toBe(false);
    expect(isLateCoffee({ coffee_cups: 0, coffee_last_time: "18:00" })).toBe(false);
    expect(isLateCoffee({ coffee_cups: 1, coffee_last_time: null })).toBe(false);
  });
  it("writes it in plain words", () => {
    expect(coffeeText({ coffee_cups: null, coffee_last_time: null })).toBeNull();
    expect(coffeeText({ coffee_cups: 0, coffee_last_time: null })).toBe("None");
    expect(coffeeText({ coffee_cups: 1, coffee_last_time: null })).toBe("1 cup");
    expect(coffeeText({ coffee_cups: 3, coffee_last_time: "15:30:00" })).toBe("3 cups, last at 15:30");
  });
});
