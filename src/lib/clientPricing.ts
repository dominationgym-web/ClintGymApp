// A trainer's client prices and the monthly income they add up to (0106).
// Kept free of Supabase and React Native imports so it can be unit tested.
// clientPrice() mirrors client_monthly_price() in the database.
import type { AccessStatus, ClientPriceList, ClientPrices, ClientRate, PricePackage } from "@/types/database";

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

function listPrice(list: ClientPriceList | null | undefined, mode: ClientPrices["mode"], pkg: PricePackage | null | undefined): number | null {
  if (!list) return null;
  if (mode === "flat") return amount(list.flat);
  if (pkg === "online") return amount(list.online);
  if (pkg?.startsWith("extra_")) return amount(list.extra?.[pkg.slice(6) as (typeof EXTRA_DAYS)[number]]);
  return null;
}

/** What one client pays a month on the Local prices, or null when no price applies yet. */
export function clientPrice(prices: ClientPrices | null | undefined, pkg: PricePackage | null | undefined): number | null {
  return prices ? listPrice(prices, prices.mode, pkg) : null;
}

// Local and international prices (GRIZZ 2026-11-19, 0231). A client is
// international when they live in another country than their trainer, unless
// the trainer picked Local or International for them by hand.

/** The trainer's own country: where their phone was when they applied, South Africa if unknown. */
export function trainerCountry(t: { signup_country?: string | null } | null | undefined): string {
  return (t?.signup_country || "ZA").toUpperCase();
}

type RatedClient = { residence_country?: string | null; client_rate?: ClientRate | null };

/** What the country alone says, before the trainer's own pick. */
export function suggestedRate(residence: string | null | undefined, homeCountry: string): ClientRate {
  return residence && residence.toUpperCase() !== homeCountry.toUpperCase() ? "international" : "local";
}

export function clientRate(c: RatedClient, homeCountry: string): ClientRate {
  return c.client_rate ?? suggestedRate(c.residence_country, homeCountry);
}

export type RatePrice = { amount: number; currency: string };

/**
 * What one client pays a month in the right currency. International clients
 * pay the dollar list; if that price is left blank, the Local one applies.
 */
export function ratePrice(prices: ClientPrices | null | undefined, pkg: PricePackage | null | undefined, rate: ClientRate): RatePrice | null {
  if (!prices) return null;
  if (rate === "international") {
    const usd = listPrice(prices.international, prices.mode, pkg);
    if (usd !== null) return { amount: usd, currency: "USD" };
  }
  const local = clientPrice(prices, pkg);
  return local === null ? null : { amount: local, currency: prices.currency || "ZAR" };
}

type PricedClient = RatedClient & { price_package?: PricePackage | null; archived_at: string | null; access_status: AccessStatus };

export type IncomeLine = { key: string; label: string; clients: number; price: number; currency: string; total: number };

export type IncomeSummary = {
  /** Totals by currency, Local currency first: { ZAR: 12000, USD: 450 }. */
  totals: { currency: string; total: number }[];
  active: number;
  international: number;
  /** Active clients with no price yet (no package picked, or that price left blank). */
  unpriced: number;
  lines: IncomeLine[];
};

/** Monthly income from a trainer's active clients (not archived, not expired). */
export function incomeSummary(
  prices: ClientPrices | null | undefined,
  clients: PricedClient[],
  homeCountry = "ZA"
): IncomeSummary {
  const active = clients.filter((c) => !c.archived_at && c.access_status !== "expired");
  const summary: IncomeSummary = { totals: [], active: active.length, international: 0, unpriced: 0, lines: [] };
  const byKey = new Map<string, IncomeLine>();
  const totals = new Map<string, number>();
  for (const c of active) {
    const rate = clientRate(c, homeCountry);
    if (rate === "international") summary.international += 1;
    const price = ratePrice(prices, c.price_package, rate);
    if (price === null) {
      summary.unpriced += 1;
      continue;
    }
    const pkgKey = prices?.mode === "flat" ? "flat" : (c.price_package as PricePackage);
    const local = prices?.currency || "ZAR";
    const key = price.currency === local ? pkgKey : `${pkgKey}:${price.currency}`;
    const intl = price.currency !== local;
    const base = pkgKey === "flat" ? "Monthly fee" : packageLabel(pkgKey as PricePackage) ?? pkgKey;
    const line =
      byKey.get(key) ??
      ({ key, label: intl ? `${base} (international)` : base, clients: 0, price: price.amount, currency: price.currency, total: 0 } as IncomeLine);
    line.clients += 1;
    line.total += price.amount;
    byKey.set(key, line);
    totals.set(price.currency, (totals.get(price.currency) ?? 0) + price.amount);
  }
  const local = prices?.currency || "ZAR";
  summary.totals = [...totals.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => (a.currency === local ? -1 : b.currency === local ? 1 : 0));
  const order = ["flat", ...PRICE_PACKAGES.map((p) => p.key)];
  const rank = (l: IncomeLine) => order.indexOf(l.key.split(":")[0]) * 2 + (l.currency === local ? 0 : 1);
  summary.lines = [...byKey.values()].sort((a, b) => rank(a) - rank(b));
  return summary;
}

// Currencies a trainer can pick for their Local prices. Dollars are the
// international currency, but a trainer in the US picks them as Local too.
export const LOCAL_CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "ZAR", symbol: "R", label: "Rand (R)" },
  { code: "USD", symbol: "$", label: "US dollar ($)" },
  { code: "GBP", symbol: "£", label: "Pound (£)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "AUD", symbol: "A$", label: "Aussie dollar (A$)" },
  { code: "NZD", symbol: "NZ$", label: "NZ dollar (NZ$)" },
  { code: "CAD", symbol: "C$", label: "Canadian dollar (C$)" },
  { code: "AED", symbol: "AED ", label: "Dirham (AED)" },
  { code: "NAD", symbol: "N$", label: "Namibian dollar (N$)" },
  { code: "BWP", symbol: "P", label: "Pula (P)" },
];

export function currencySymbol(code: string | null | undefined): string {
  return LOCAL_CURRENCIES.find((c) => c.code === code)?.symbol ?? (code ? `${code} ` : "R");
}

/** "R1 500", "£45", "$60.50" for any of the currencies above. */
export function priceText(value: number, code: string | null | undefined): string {
  const rounded = Math.round(value * 100) / 100;
  const [whole, cents] = rounded.toFixed(2).split(".");
  // No-break space between thousands for rand, so "R2 840" never splits over two lines.
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, code === "ZAR" || !code ? "\u00a0" : ",");
  return `${currencySymbol(code)}${cents === "00" ? grouped : `${grouped}.${cents}`}`;
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
