import { describe, expect, it } from "vitest";
import { clientPrice, incomeSummary, parsePrice } from "@/lib/clientPricing";
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
    expect(s.total).toBe(3300);
    expect(s.active).toBe(4);
    expect(s.unpriced).toBe(1);
    expect(s.lines.map((l) => [l.key, l.clients, l.total])).toEqual([
      ["online", 2, 3000],
      ["extra_1", 1, 300],
    ]);
  });
  it("puts everyone on one line in monthly-fee mode", () => {
    const s = incomeSummary(flat, [client(null), client("online")]);
    expect(s.total).toBe(240);
    expect(s.lines).toEqual([{ key: "flat", label: "Monthly fee", clients: 2, price: 120, total: 240 }]);
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
