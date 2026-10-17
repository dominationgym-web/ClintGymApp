import { describe, expect, it } from "vitest";
import { clientIncomeTotals, trackerTotals, trainerPlanLine } from "@/lib/tracker";
import type { OwnerTrackerRow } from "@/types/database";

const today = "2026-10-17";
const row = (over: Partial<OwnerTrackerRow>): OwnerTrackerRow => ({
  trainer_id: "t",
  name: "Trainer",
  is_owner: false,
  region: "SA",
  currency: "ZAR",
  billing_plan: null,
  trial_ends_at: null,
  paid_until: null,
  free_use: false,
  clients_total: 0,
  clients_active: 0,
  client_fee_now: 0,
  client_fee_full: 0,
  plan_price: 0,
  paid_subs_month: 0,
  paid_fees_month: 0,
  ...over,
});

describe("trackerTotals", () => {
  it("splits clients and money into SA and International", () => {
    const t = trackerTotals(
      [
        row({ is_owner: true, clients_active: 9, clients_total: 10 }),
        row({ clients_active: 8, clients_total: 9, client_fee_now: 300, client_fee_full: 300, billing_plan: "six_months", plan_price: 2500, paid_until: "2027-01-01", paid_subs_month: 2500 }),
        row({ region: "International", currency: "USD", clients_active: 7, client_fee_full: 20, trial_ends_at: "2026-10-31" }),
      ],
      today,
    );
    expect(t.trainers).toBe(2);
    expect(t.onTrial).toBe(1);
    expect(t.clients).toEqual({ active: 24, total: 19, sa: 17, international: 7, ownActive: 9 });
    expect(t.money.ZAR).toEqual({ clientFeesNow: 300, clientFeesFull: 300, paidSubs: 1, subsMonthly: 2500 / 6, paidThisMonth: 2500 });
    expect(t.money.USD.clientFeesFull).toBe(20);
    expect(t.money.USD.paidSubs).toBe(0);
  });

  it("counts trainers with no country yet and leaves lapsed plans out of subs", () => {
    const t = trackerTotals(
      [row({ region: null, currency: null, clients_active: 2, billing_plan: "monthly", plan_price: 50, paid_until: "2026-10-01" })],
      today,
    );
    expect(t.noRegion).toBe(1);
    expect(t.clients.sa + t.clients.international).toBe(0);
    expect(t.money.USD.paidSubs).toBe(0);
  });
});

describe("trainerPlanLine", () => {
  it("describes where each trainer is", () => {
    expect(trainerPlanLine(row({ trial_ends_at: "2026-10-31" }), today)).toBe("Trial to 31 Oct");
    expect(trainerPlanLine(row({ free_use: true }), today)).toBe("Free use");
    expect(trainerPlanLine(row({ billing_plan: "monthly", paid_until: "2026-11-01" }), today)).toBe("Paid");
    expect(trainerPlanLine(row({ billing_plan: "monthly", paid_until: "2026-10-01" }), today)).toBe("Payment due");
    expect(trainerPlanLine(row({}), today)).toBe("No plan yet");
  });
});

describe("clientIncomeTotals", () => {
  it("adds up what clients pay trainers, rand and dollars apart", () => {
    const t = clientIncomeTotals([
      { trainer_id: "a", currency: "ZAR", income: 3000, priced: 2, unpriced: 1 },
      { trainer_id: "b", currency: "USD", income: 240, priced: 2, unpriced: 0 },
      { trainer_id: "c", currency: "ZAR", income: 1000, priced: 1, unpriced: 3 },
    ]);
    expect(t).toEqual({ ZAR: { income: 4000, priced: 3 }, USD: { income: 240, priced: 2 }, unpriced: 4 });
  });
});
