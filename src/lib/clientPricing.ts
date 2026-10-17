// A trainer's client prices and the monthly income they add up to (0106).
// Kept free of Supabase and React Native imports so it can be unit tested.
// clientPrice() mirrors client_monthly_price() in the database.
import type { AccessStatus, ClientPrices, PricePackage } from "@/types/database";

export const PRICE_PACKAGES: { key: PricePackage; label: string; short: string }[] = [
  { key: "online", label: "Fully Online", short: "Online" },
  { key: "extra_1", label: "1-on-1 + 1 extra day a week", short: "+1 day" },
  { key: "extra_2", label: "1-on-1 + 2 extra days a week", short: "+2 days" },
  { key: "extra_3", label: "1-on-1 + 3 extra days a week", short: "+3 days" },
  { key: "extra_4", label: "1-on-1 + 4 extra days a week", short: "+4 days" },
];

export const EXTRA_DAYS = ["1", "2", "3", "4"] as const;

export function packageLabel(pkg: PricePackage | null | undefined): string | null {
  return PRICE_PACKAGES.find((p) => p.key === pkg)?.label ?? null;
}

const amount = (value: number | null | undefined): number | null =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);

/** What one client pays a month, or null when no price applies yet. */
export function clientPrice(prices: ClientPrices | null | undefined, pkg: PricePackage | null | undefined): number | null {
  if (!prices) return null;
  if (prices.mode === "flat") return amount(prices.flat);
  if (pkg === "online") return amount(prices.online);
  if (pkg?.startsWith("extra_")) return amount(prices.extra?.[pkg.slice(6) as (typeof EXTRA_DAYS)[number]]);
  return null;
}

type PricedClient = { price_package?: PricePackage | null; archived_at: string | null; access_status: AccessStatus };

export type IncomeLine = { key: PricePackage | "flat"; label: string; clients: number; price: number; total: number };

export type IncomeSummary = {
  total: number;
  active: number;
  /** Active clients with no price yet (no package picked, or that price left blank). */
  unpriced: number;
  lines: IncomeLine[];
};

/** Monthly income from a trainer's active clients (not archived, not expired). */
export function incomeSummary(prices: ClientPrices | null | undefined, clients: PricedClient[]): IncomeSummary {
  const active = clients.filter((c) => !c.archived_at && c.access_status !== "expired");
  const summary: IncomeSummary = { total: 0, active: active.length, unpriced: 0, lines: [] };
  const byKey = new Map<string, IncomeLine>();
  for (const c of active) {
    const price = clientPrice(prices, c.price_package);
    if (price === null) {
      summary.unpriced += 1;
      continue;
    }
    const key = prices?.mode === "flat" ? "flat" : (c.price_package as PricePackage);
    const line =
      byKey.get(key) ??
      ({ key, label: key === "flat" ? "Monthly fee" : packageLabel(key) ?? key, clients: 0, price, total: 0 } as IncomeLine);
    line.clients += 1;
    line.total += price;
    byKey.set(key, line);
    summary.total += price;
  }
  const order = ["flat", ...PRICE_PACKAGES.map((p) => p.key)];
  summary.lines = [...byKey.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return summary;
}

/** Turns a typed price into a number, or null when it's blank or not a number. */
export function parsePrice(text: string): number | null {
  // "1,500" is fifteen hundred; "99,50" is ninety-nine fifty.
  const cleaned = text
    .replace(/[^0-9.,]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
