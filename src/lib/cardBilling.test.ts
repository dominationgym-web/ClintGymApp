import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const { cardExpired, cardLabel, chargedLabel } = await import("@/lib/cardBilling");

const card = { card_type: "visa ", last4: "4081", exp_month: "3", exp_year: "2027", bank: null, autopay: true };

describe("card billing helpers", () => {
  it("names the saved card", () => {
    expect(cardLabel(card)).toBe("Visa ending 4081, expires 03/27");
  });

  it("knows when a card has expired", () => {
    expect(cardExpired(card, "2027-03-15")).toBe(false);
    expect(cardExpired(card, "2027-04-01")).toBe(true);
  });

  it("shows the rand amount only when a dollar bill is charged in rand", () => {
    const q = { currency: "USD" as const, plan_amount: 50, plan_months: 1, plan_label: "Monthly plan", fees_amount: 20, total: 70, charged_currency: "ZAR", charged_cents: 126000 };
    expect(chargedLabel(q)).toBe("R1 260");
    expect(chargedLabel({ ...q, currency: "ZAR", charged_cents: 50000 })).toBeNull();
  });
});
