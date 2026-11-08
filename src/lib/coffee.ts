// Coffee on the daily check-in (0203; GRIZZ, 2026-11-08: "coffee intake and
// time of last cup. To help track sleep problems and fatigue").
//
// The morning check-in asks about yesterday: how many cups and when the last
// one was. Caffeine takes 5 to 6 hours to wear off by half, so a cup at 14:00
// or later is still working at bedtime. That's a "late" cup here.

/** A last cup at this time or later counts as late. */
export const LATE_COFFEE = "14:00";

type CoffeeAnswer = { coffee_cups: number | null; coffee_last_time: string | null };

/** True when they had coffee and the last cup was at 14:00 or later. */
export function isLateCoffee(c: CoffeeAnswer): boolean {
  return !!c.coffee_cups && !!c.coffee_last_time && c.coffee_last_time.slice(0, 5) >= LATE_COFFEE;
}

/** "3 cups, last at 15:30", "1 cup", "None", or null when not answered. */
export function coffeeText(c: CoffeeAnswer): string | null {
  if (c.coffee_cups === null) return null;
  if (c.coffee_cups === 0) return "None";
  const cups = `${c.coffee_cups} cup${c.coffee_cups === 1 ? "" : "s"}`;
  return c.coffee_last_time ? `${cups}, last at ${c.coffee_last_time.slice(0, 5)}` : cups;
}
