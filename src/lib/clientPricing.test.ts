import { describe, expect, it } from "vitest";
import { clientPrice, clientRate, incomeSummary, parsePrice, priceText, ratePrice, suggestedRate } from "@/lib/clientPricing";
import type { AccessStatus, ClientPrices, PricePackage } from "@/types/database";

const table: ClientPrices = { currency: "ZAR", mode: "table", online: 1500, extra: { "1": 300, "2": 500, "4": 900 } };
const flat: ClientPrices = { currency: "USD", mode: "flat", flat: 120 };
const client = (price_package: PricePackage | null, over: Partial<{ archived_at: string | null; access_status: AccessStatus }> = {}) => ({
  price_package,
  archived_at: null,
  access_status: "active" as const,
  ...over,
});

describe("clientPrice", () => {
  it("reads the table by package", () => {
    expect(clientPrice(table, "online")).toBe(1500);
    expect(clientPrice(table, "extra_2")).toBe(500);
    expect(clientPrice(table, "extra_3")).toBeNull();
    expect(clientPrice(table, null)).toBeNull();
  });
  it("gives everyone the flat fee in monthly-fee mode", () => {
    expect(clientPrice(flat, null)).toBe(120);
    expect(clientPrice(flat, "extra_4")).toBe(120);
  });
  it("has no price without prices", () => {
    expect(clientPrice(null, "online")).toBeNull();
  });
});

describe("incomeSummary", () => {
  it("adds up active clients by package and counts the ones without a price", () => {
    const s = incomeSummary(table, [
      client("online"),
      client("online"),
      client("extra_1"),
      client(null),
      client("online", { archived_at: "2026-10-01" }),
      client("online", { access_status: "expired" }),
    ]);
    expect(s.totals).toEqual([{ currency: "ZAR", total: 3300 }]);
    expect(s.active).toBe(4);
    expect(s.unpriced).toBe(1);
    expect(s.lines.map((l) => [l.key, l.clients, l.total])).toEqual([
      ["online", 2, 3000],
      ["extra_1", 1, 300],
    ]);
  });
  it("puts everyone on one line in monthly-fee mode", () => {
    const s = incomeSummary(flat, [client(null), client("online")]);
    expect(s.totals).toEqual([{ currency: "USD", total: 240 }]);
    expect(s.lines).toEqual([{ key: "flat", label: "Monthly fee", clients: 2, price: 120, currency: "USD", total: 240 }]);
  });
});

describe("local and international prices", () => {
  const both: ClientPrices = { ...table, international: { online: 100, extra: { "1": 30 } } };
  const abroad = (price_package: PricePackage | null, residence_country: string | null, client_rate: "local" | "international" | null = null) => ({
    ...client(price_package),
    residence_country,
    client_rate,
  });
  it("calls someone international when they live in another country than the trainer", () => {
    expect(suggestedRate("GB", "ZA")).toBe("international");
    expect(suggestedRate("za", "ZA")).toBe("local");
    expect(suggestedRate(null, "ZA")).toBe("local");
  });
  it("lets the trainer's own pick win over the country", () => {
    expect(clientRate({ residence_country: "GB", client_rate: "local" }, "ZA")).toBe("local");
    expect(clientRate({ residence_country: "ZA", client_rate: "international" }, "ZA")).toBe("international");
  });
  it("charges international clients the dollar list, falling back to Local when it's blank", () => {
    expect(ratePrice(both, "online", "international")).toEqual({ amount: 100, currency: "USD" });
    expect(ratePrice(both, "extra_2", "international")).toEqual({ amount: 500, currency: "ZAR" });
    expect(ratePrice(both, "online", "local")).toEqual({ amount: 1500, currency: "ZAR" });
  });
  it("adds up rand and dollars separately", () => {
    const s = incomeSummary(both, [abroad("online", "ZA"), abroad("online", "GB"), abroad("online", "US"), abroad("extra_1", "AU", "local")], "ZA");
    expect(s.totals).toEqual([
      { currency: "ZAR", total: 1800 },
      { currency: "USD", total: 200 },
    ]);
    expect(s.international).toBe(2);
    expect(s.lines.map((l) => [l.label, l.clients, l.total])).toEqual([
      ["Fully Online", 1, 1500],
      ["Fully Online (international)", 2, 200],
      ["1-on-1 + 1 extra day a week", 1, 300],
    ]);
  });
  it("writes prices in each currency", () => {
    expect(priceText(1500, "ZAR")).toBe("R1\u00a0500");
    expect(priceText(60.5, "USD")).toBe("$60.50");
    expect(priceText(1200, "GBP")).toBe("£1,200");
  });
});

describe("parsePrice", () => {
  it("reads typed prices", () => {
    expect(parsePrice("R1 500")).toBe(1500);
    expect(parsePrice("99,50")).toBe(99.5);
    expect(parsePrice("1,500")).toBe(1500);
    expect(parsePrice("$1,250.50")).toBe(1250.5);
    expect(parsePrice("")).toBeNull();
  });
});
