import { describe, expect, it } from "vitest";
import {
  agreementCurrent,
  autoCharge,
  cancelPreview,
  fillAgreement,
  invoiceText,
  monthGrid,
  noticeText,
  regularLabel,
  sessionKind,
  shiftMonth,
  slotTimes,
  cleanTime,
  toggleRegular,
} from "./liveSessions";
import type { SessionInvoice } from "@/types/database";

const at = "2026-11-04T06:00:00";

describe("cancellations", () => {
  it("credits a 24h-rule cancellation with a day's notice and charges a later one", () => {
    expect(autoCharge("24h", "client", at, "2026-11-03T05:00:00")).toBe("credit");
    expect(autoCharge("24h", "client", at, "2026-11-03T06:00:00")).toBe("credit");
    expect(autoCharge("24h", "client", at, "2026-11-03T20:00:00")).toBe("charge");
    expect(autoCharge("12h", "client", at, "2026-11-03T17:00:00")).toBe("credit");
    expect(autoCharge("12h", "client", at, "2026-11-03T20:00:00")).toBe("charge");
  });

  it("leaves it to the trainer, and always credits the trainer's own cancellation", () => {
    expect(autoCharge("trainer", "client", at, "2026-11-04T05:00:00")).toBeNull();
    expect(autoCharge("24h", "trainer", at, "2026-11-04T05:30:00")).toBe("credit");
  });

  it("tells the client before they cancel", () => {
    expect(cancelPreview("24h", at, new Date("2026-11-03T20:00:00"))).toEqual({
      charged: true,
      text: "That's only 10 hours' notice. Your agreement asks for 24 hours, so this session will still be charged.",
    });
    expect(cancelPreview("24h", at, new Date("2026-11-01T06:00:00")).charged).toBe(false);
    expect(cancelPreview("trainer", at, new Date("2026-11-03T06:00:00")).charged).toBeNull();
  });

  it("words the notice", () => {
    expect(noticeText(0.5)).toBe("30 minutes' notice");
    expect(noticeText(1)).toBe("1 hour's notice");
    expect(noticeText(30)).toBe("30 hours' notice");
    expect(noticeText(72)).toBe("3 days' notice");
    expect(noticeText(-2)).toBe("no notice");
  });
});

describe("sessionKind", () => {
  const base = { starts_at: "2026-11-04T06:00:00", minutes: 60, charge: null, cancelled_by: null } as const;
  const now = new Date("2026-11-04T08:00:00");
  it("matches the database", () => {
    expect(sessionKind({ ...base, status: "booked" }, now)).toBe("unconfirmed");
    expect(sessionKind({ ...base, status: "booked" }, new Date("2026-11-04T06:30:00"))).toBe("booked");
    expect(sessionKind({ ...base, status: "done" }, now)).toBe("done");
    expect(sessionKind({ ...base, status: "no_show", charge: "charge" }, now)).toBe("no_show");
    expect(sessionKind({ ...base, status: "cancelled", cancelled_by: "client", charge: "charge" }, now)).toBe("late");
    expect(sessionKind({ ...base, status: "cancelled", cancelled_by: "client", charge: "credit" }, now)).toBe("notice");
    expect(sessionKind({ ...base, status: "cancelled", cancelled_by: "client" }, now)).toBe("decide");
    expect(sessionKind({ ...base, status: "cancelled", cancelled_by: "trainer", charge: "credit" }, now)).toBe("trainer");
  });
});

describe("calendar helpers", () => {
  it("lays out November 2026 Monday first", () => {
    const weeks = monthGrid("2026-11-01");
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[weeks.length - 1][0]).toBe("2026-11-30");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("moves months across the year end", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("names regular times", () => {
    const r = toggleRegular(toggleRegular(toggleRegular([], 5, "06:00"), 1, "06:00"), 3, "06:00");
    expect(regularLabel(r)).toBe("Mon, Wed and Fri at 06:00");
    expect(regularLabel(toggleRegular(r, 3, "06:00"))).toBe("Mon and Fri at 06:00");
    expect(regularLabel([{ weekday: 2, time: "17:30" }, { weekday: 1, time: "06:00" }])).toBe("Mon 06:00, Tue 17:30");
    expect(regularLabel([])).toBe("No regular times");
  });
});

describe("agreement", () => {
  const terms = { coach: "GRIZZ", client: "Nancy", fee: "R400", policy: "24h" as const, billing: "advance" as const, minutes: 60, regular: [] };
  it("fills GRIZZ's agreement with the client's terms", () => {
    const text = fillAgreement(null, {
      ...terms,
      fee: "R750",
      minutes: 40,
      regular: [{ weekday: 5, time: "05:50" }, { weekday: 1, time: "05:50" }, { weekday: 3, time: "05:50" }],
      contact: "082 123 4567",
    });
    expect(text).toContain("all sessions are paid for in advance");
    expect(text).toContain("We have a 24 hour cancellation policy");
    expect(text).toContain("contact me on 082 123 4567.");
    expect(text).toContain("I accept the rate of R750 for a 40 min session.");
    expect(text).toContain("My confirmed slot is Monday, Wednesday and Friday at 05:50.");
  });

  it("uses the trainer's own text when they changed it", () => {
    expect(fillAgreement("{client} pays {fee}, {cancelHours}h", { ...terms, policy: "12h", regular: [] })).toBe("Nancy pays R400, 12h");
  });

  it("needs signing again when the terms change", () => {
    const plan = { fee: 400, per_week: 3, billing: "advance" as const, policy: "24h" as const };
    expect(agreementCurrent({ ...plan, fee: "400.00" as unknown as number }, plan)).toBe(true);
    expect(agreementCurrent({ ...plan, fee: 350 }, plan)).toBe(false);
    expect(agreementCurrent(null, plan)).toBe(false);
  });
});

describe("invoiceText", () => {
  it("lists every session with its colour and the total", () => {
    const inv = {
      month: "2026-10-01",
      billing: "arrears",
      currency: "ZAR",
      charged: 800,
      credited: 400,
      total: 400,
      lines: [
        { at: "2026-10-07T06:00:00", kind: "late", role: "charge", amount: 400, notice_hours: 10 },
        { at: "2026-10-05T06:00:00", kind: "done", role: "charge", amount: 400, notice_hours: null },
        { at: "2026-10-09T06:00:00", kind: "notice", role: "credit", amount: -400, notice_hours: 49 },
      ],
    } as unknown as SessionInvoice;
    const text = invoiceText(inv, "Nancy", "GRIZZ");
    const rows = text.split("\n");
    expect(rows[0]).toBe("🧾 Session invoice · October 2026");
    expect(rows[3]).toBe("✅ Mon 5 Oct 06:00 · Trained R400");
    expect(rows[4]).toBe("🔴 Wed 7 Oct 06:00 · Late cancellation · 10 hours' notice R400");
    expect(rows[5]).toBe("🟢 Fri 9 Oct 06:00 · Cancelled in time · 2 days' notice (credit) -R400");
    expect(text).toContain("Total: R400");
  });
});

describe("slotTimes", () => {
  it("staggers by the session length from the first session (GRIZZ's 05:10 example)", () => {
    expect(slotTimes("05:10", "08:00", 40)).toEqual(["05:10", "05:50", "06:30", "07:10"]);
  });

  it("starts a new run straight after a booked session", () => {
    const times = slotTimes("09:00", "12:00", 40, [{ time: "10:00", minutes: 40 }]);
    expect(times).toEqual(["09:00", "10:40", "11:20"]);
  });

  it("reads times typed in different ways", () => {
    expect(cleanTime("5:10")).toBe("05:10");
    expect(cleanTime("05:10:00")).toBe("05:10");
    expect(cleanTime("5.10")).toBe("05:10");
    expect(cleanTime("25:00")).toBeNull();
  });
});
