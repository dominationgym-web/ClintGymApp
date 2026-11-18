import { describe, expect, it } from "vitest";
import { billingEmail, niceDate } from "../../supabase/functions/billing-emails/content";

const who = { name: "Thabo Mokoena", site: "https://dailyevolution.co.za" };

describe("trainer payment emails (0226)", () => {
  it("formats dates in plain words", () => {
    expect(niceDate("2026-12-01")).toBe("1 December");
    expect(niceDate(null)).toBe("");
  });

  it("plan due: Pay now button to the website and the three steps", () => {
    const e = billingEmail("plan_due", { due_on: "2026-12-01", autopay: false }, who);
    expect(e.subject).toBe("Your Daily Evolution plan is due on 1 December");
    expect(e.text).toContain("Hi Thabo,");
    expect(e.text).toContain("1. Go to dailyevolution.co.za/app");
    expect(e.text).toContain("Pay now: https://dailyevolution.co.za/app/");
    expect(e.html).toContain('href="https://dailyevolution.co.za/app/"');
  });

  it("saved card: a heads-up with nothing to do and no button", () => {
    const e = billingEmail("plan_due", { due_on: "2026-12-01", autopay: true }, who);
    expect(e.text).toContain("nothing to do");
    expect(e.text).not.toContain("Pay now");
    expect(e.html).not.toContain("Pay now");
  });

  it("overdue with a failed saved card asks for another card", () => {
    const e = billingEmail("plan_overdue", { due_on: "2026-11-30", autopay: true, paused: true }, who);
    expect(e.subject).toBe("Your Daily Evolution plan is overdue");
    expect(e.text).toContain("couldn't take your plan payment");
    expect(e.text).toContain("paused");
    expect(e.text).toContain("Pay now");
  });

  it("welcome explains paying happens on the website", () => {
    const e = billingEmail("welcome", { trial_ends_at: "2026-12-17" }, who);
    expect(e.text).toContain("until 17 December");
    expect(e.text).toContain("on our website, not in the app");
    expect(e.text).toContain("Open the website: https://dailyevolution.co.za/app/");
  });

  it("client fees show the amount and due date", () => {
    const e = billingEmail("client_fees", { month: "November 2026", clients: 8, amount: "R30", due_on: "2026-12-07", autopay: false }, who);
    expect(e.subject).toBe("Your client fees for November 2026");
    expect(e.text).toContain("8 active clients. Your client fees are R30, due by 7 December.");
  });

  it("escapes names in the HTML", () => {
    const e = billingEmail("plan_due_today", {}, { ...who, name: "<b>Sam</b>" });
    expect(e.html).not.toContain("<b>Sam");
  });
});
