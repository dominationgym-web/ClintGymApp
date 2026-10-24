import { describe, expect, it } from "vitest";
import {
  amountsLabel,
  clientFeeTotal,
  clientTierLines,
  creditsUsable,
  feeCreditsUsable,
  freeUseFeesStart,
  halfYearKey,
  halfYearLabel,
  halfYearTotals,
  money,
  planAmountDue,
  planState,
  planStateLabel,
  referralCreditUseLine,
  referralCreditValue,
  referralPopupDue,
  trainerCurrency,
} from "@/lib/billing";
import type { BillingPrices, ClientTier } from "@/types/database";

const prices: BillingPrices = {
  USD: { monthly: 50, six_months: 250, yearly: 400, client: 10 },
  ZAR: { monthly: 500, six_months: 2500, yearly: 4000, client: 180 },
};

describe("billing helpers", () => {
  it("formats money in both currencies", () => {
    expect(money(50, "USD")).toBe("$50");
    expect(money(12.5, "USD")).toBe("$12.50");
    expect(money(2500, "ZAR")).toBe("R2 500");
    expect(money(1250, "USD")).toBe("$1,250");
  });

  it("values referral credit at 25% of a month", () => {
    expect(referralCreditValue(prices, "USD", 1)).toBe(12.5);
    expect(referralCreditValue(prices, "ZAR", 4)).toBe(500);
  });

  it("takes referral credit off a plan payment without going below zero", () => {
    expect(planAmountDue(prices, "USD", "monthly", 2)).toBe(25);
    expect(planAmountDue(prices, "USD", "monthly", 6)).toBe(0);
    expect(planAmountDue(prices, "ZAR", "six_months", 2)).toBe(2250);
    expect(creditsUsable(prices, "USD", "monthly", 6)).toBe(4);
    expect(creditsUsable(prices, "USD", "yearly", 3)).toBe(3);
  });

  it("works out where a plan stands", () => {
    const today = "2026-10-11";
    expect(planState({ billing_started_on: null, paid_until: null, trial_ends_at: "2026-10-20" }, today).kind).toBe("trial");
    expect(planState({ billing_started_on: null, paid_until: null }, today).kind).toBe("none");
    expect(planStateLabel(planState({ billing_started_on: "2026-10-01", paid_until: null }, today))).toBe(
      "Overdue since 1 Oct 2026",
    );
    expect(planStateLabel(planState({ billing_started_on: "2026-09-01", paid_until: "2026-10-09" }, today))).toBe(
      "Overdue since 10 Oct 2026",
    );
    expect(planStateLabel(planState({ billing_started_on: "2026-09-01", paid_until: "2026-10-13" }, today))).toBe("Due in 2 days");
    expect(planStateLabel(planState({ billing_started_on: "2026-09-01", paid_until: "2026-11-30" }, today))).toBe(
      "Paid until 30 Nov 2026",
    );
  });

  it("groups totals into half-years", () => {
    expect(halfYearKey("2026-06-30")).toBe("2026-H1");
    expect(halfYearKey("2026-07-01")).toBe("2026-H2");
    expect(halfYearLabel("2026-H2")).toBe("Jul - Dec 2026");
    const totals = halfYearTotals({
      months: [
        { month: "2026-08-01", client_fee: 20, currency: "USD" },
        { month: "2026-09-01", client_fee: 360, currency: "ZAR" },
        { month: "2026-05-01", client_fee: 10, currency: "USD" },
      ],
      payments: [
        { paid_on: "2026-08-03", amount: 50, currency: "USD", kind: "subscription" },
        { paid_on: "2026-09-05", amount: 20, currency: "USD", kind: "client_fees" },
        { paid_on: "2026-09-06", amount: 12.5, currency: "USD", kind: "client_fees", note: "Referral credit: 1 × 25%" },
      ],
      activations: [{ activated_on: "2026-08-10" }, { activated_on: "2026-09-10" }],
      referralApprovals: ["2026-07-15"],
    });
    expect(totals.map((t) => t.key)).toEqual(["2026-H2", "2026-H1"]);
    expect(amountsLabel(totals[0].clientFees)).toBe("$20 + R360");
    expect(totals[0].activations).toBe(2);
    expect(totals[0].referrals).toBe(1);
    expect(amountsLabel(totals[0].planPayments)).toBe("$50");
    expect(amountsLabel(totals[1].planPayments)).toBe("-");
  });
});

describe("free use (0096)", () => {
  it("starts per-client fees on the 1st on or after 6 months", () => {
    expect(freeUseFeesStart("2026-10-14")).toBe("2027-05-01");
    expect(freeUseFeesStart("2026-10-01")).toBe("2027-04-01");
    expect(freeUseFeesStart("2026-08-31")).toBe("2027-03-01");
    expect(freeUseFeesStart("2026-12-20")).toBe("2027-07-01");
  });
  it("shows free use instead of a plan", () => {
    const state = planState({ billing_started_on: "2026-01-01", paid_until: null, free_use_from: "2026-10-14" }, "2026-11-01");
    expect(state).toEqual({ kind: "freeUse", feesFrom: "2027-05-01" });
    expect(planStateLabel(state)).toContain("Free use");
  });
});

describe("referral credit off client fees", () => {
  const prices = { USD: { monthly: 50, six_months: 250, yearly: 400, client: 10 }, ZAR: { monthly: 500, six_months: 2500, yearly: 4000, client: 100 } };
  it("uses whole R125 credits, never more than is owed", () => {
    expect(feeCreditsUsable(prices, "ZAR", 300, 5)).toBe(2);
    expect(feeCreditsUsable(prices, "ZAR", 1000, 3)).toBe(3);
    expect(feeCreditsUsable(prices, "ZAR", 100, 3)).toBe(0);
    expect(feeCreditsUsable(prices, "ZAR", 0, 3)).toBe(0);
  });
});

describe("weekly referral pop-up", () => {
  it("shows the first time, then once every 7 days", () => {
    expect(referralPopupDue(null, "2026-10-14")).toBe(true);
    expect(referralPopupDue("2026-10-14", "2026-10-14")).toBe(false);
    expect(referralPopupDue("2026-10-08", "2026-10-14")).toBe(false);
    expect(referralPopupDue("2026-10-07", "2026-10-14")).toBe(true);
    expect(referralPopupDue("garbage", "2026-10-14")).toBe(true);
  });
  it("picks the currency and where credit comes off", () => {
    expect(trainerCurrency({ billing_currency: null, signup_country: "ZA" })).toBe("ZAR");
    expect(trainerCurrency({ billing_currency: null, signup_country: "GB" })).toBe("USD");
    expect(trainerCurrency({ billing_currency: "USD", signup_country: "ZA" })).toBe("USD");
    expect(referralCreditUseLine(true)).toContain("client fees");
    expect(referralCreditUseLine(false)).toContain("plan payment");
  });
});

describe("tiered client fees (GRIZZ 2026-10-22, bands 2026-10-24)", () => {
  const tiers: ClientTier[] = [
    { upto: 15, ZAR: 50, USD: 5 },
    { upto: 25, ZAR: 40, USD: 4 },
    { upto: 35, ZAR: 30, USD: 3 },
    { upto: 65, ZAR: 10, USD: 1 },
  ];

  it("matches the example totals with R200 / $20 a month and 5 clients included", () => {
    const table: [number, number, number][] = [
      [5, 200, 20], [10, 450, 45], [15, 700, 70], [20, 900, 90], [25, 1100, 110], [30, 1250, 125],
      [35, 1400, 140], [40, 1450, 145], [50, 1550, 155], [60, 1650, 165], [65, 1700, 170], [66, 1700, 170], [120, 1700, 170],
    ];
    for (const [clients, zar, usd] of table) {
      expect(200 + clientFeeTotal(tiers, "ZAR", clients, 5)).toBe(zar);
      expect(20 + clientFeeTotal(tiers, "USD", clients, 5)).toBe(usd);
    }
  });

  it("charges free-use trainers from their first client", () => {
    expect(clientFeeTotal(tiers, "ZAR", 3, 0)).toBe(150);
    expect(clientFeeTotal(tiers, "ZAR", 12, 0)).toBe(600);
    expect(clientFeeTotal(tiers, "ZAR", 17, 0)).toBe(830);
  });

  it("lists the tiers after the included clients", () => {
    expect(clientTierLines(tiers, "ZAR", 5)).toEqual([
      "Clients 6-15: R50 each",
      "Clients 16-25: R40 each",
      "Clients 26-35: R30 each",
      "Clients 36-65: R10 each",
      "Clients 66+: free",
    ]);
    expect(clientTierLines(tiers, "USD", 0)[0]).toBe("Clients 1-15: $5 each");
  });
});
