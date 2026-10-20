import { describe, expect, it } from "vitest";
import { EMPTY_WELLBEING, reportedTopics, reportsByTopic, splitKinds, toggleKind, validateWellbeing, type WellbeingForm } from "@/lib/wellbeing";
import type { Checkin } from "@/types/database";

const ok = { status: "ok" as const, kind: "", notes: "" };
const allOk: WellbeingForm = { pain: ok, fatigue: ok, mental: ok, balance: ok, symptoms: ok };

describe("validateWellbeing", () => {
  it("needs every topic answered", () => {
    const result = validateWellbeing(EMPTY_WELLBEING);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.title).toBe("Injury or pain?");
  });

  it("saves all okay with nothing flagged", () => {
    const result = validateWellbeing(allOk);
    expect(result.ok && result.values).toMatchObject({ pain_status: "ok", distress_flag: false, distress_notes: null, pain_area: null });
  });

  it("needs what it is and a note for a report", () => {
    expect(validateWellbeing({ ...allOk, pain: { status: "reported", kind: "", notes: "sore" } }).ok).toBe(false);
    expect(validateWellbeing({ ...allOk, pain: { status: "reported", kind: "Knee", notes: "  " } }).ok).toBe(false);
  });

  it("flags the trainer with a summary of every report", () => {
    const result = validateWellbeing({
      pain: { status: "reported", kind: "Knee", notes: " Sore on stairs " },
      fatigue: ok,
      mental: { status: "reported", kind: "Kids", notes: "Exams week" },
      balance: ok,
      symptoms: ok,
    });
    expect(result.ok && result.values).toMatchObject({
      pain_area: "Knee",
      pain_notes: "Sore on stairs",
      mental_cause: "Kids",
      fatigue_cause: null,
      distress_flag: true,
      distress_notes: "Injury or pain (Knee): Sore on stairs\nMental exhaustion (Kids): Exams week",
    });
  });
});

describe("reportsByTopic", () => {
  const row = (date: string, changes: Partial<Checkin>) => ({ checkin_date: date, pain_status: "ok", fatigue_status: "ok", mental_status: "ok", ...changes }) as Checkin;
  it("lists each topic's reports newest first", () => {
    const rows = [
      row("2026-10-01", { pain_status: "reported", pain_area: "Back", pain_notes: "Stiff" }),
      row("2026-10-05", { pain_status: "reported", pain_area: "Knee", pain_notes: "Sore", fatigue_status: "reported", fatigue_cause: "Heavy weekend", fatigue_notes: "Wedding" }),
      row("2026-10-06", {}),
    ];
    const reports = reportsByTopic(rows);
    expect(reports.pain.map((r) => r.kind)).toEqual(["Knee", "Back"]);
    expect(reports.fatigue).toEqual([{ date: "2026-10-05", kind: "Heavy weekend", notes: "Wedding" }]);
    expect(reports.mental).toEqual([]);
    expect(reportedTopics(rows[1])).toEqual(["Injury or pain", "Fatigue"]);
  });
});

describe("several pain areas", () => {
  it("toggles areas in list order", () => {
    expect(toggleKind("", "Knee")).toBe("Knee");
    expect(toggleKind("Knee", "Neck")).toBe("Neck, Knee");
    expect(toggleKind("Neck, Knee", "Neck")).toBe("Knee");
    expect(splitKinds("Neck, Knee")).toEqual(["Neck", "Knee"]);
  });
});

describe("dizziness and serious symptoms (0133)", () => {
  it("saves them without a note, what it was and the note in one column", () => {
    const result = validateWellbeing({
      ...allOk,
      balance: { status: "reported", kind: "Nearly fell", notes: " on the stairs " },
      symptoms: { status: "reported", kind: "Chest pain or tightness, Fainting or nearly fainting", notes: "" },
    });
    expect(result.ok && result.values).toMatchObject({
      balance_status: "reported",
      balance_notes: "Nearly fell: on the stairs",
      symptoms_status: "reported",
      symptoms: "Chest pain or tightness, Fainting or nearly fainting",
      distress_flag: true,
    });
  });

  it("still needs what it was", () => {
    expect(validateWellbeing({ ...allOk, symptoms: { status: "reported", kind: "", notes: "" } }).ok).toBe(false);
  });

  it("reads them back from a saved check-in", () => {
    const row = {
      checkin_date: "2026-10-20",
      pain_status: "ok",
      fatigue_status: "ok",
      mental_status: "ok",
      balance_status: "reported",
      balance_notes: "Dizzy or light-headed: after standing up",
      symptoms_status: "reported",
      symptoms: "Sudden severe breathlessness",
    } as unknown as Checkin;
    const reports = reportsByTopic([row]);
    expect(reports.balance[0]).toMatchObject({ kind: "Dizzy or light-headed", notes: "after standing up" });
    expect(reports.symptoms[0]).toMatchObject({ kind: "Sudden severe breathlessness", notes: "" });
    expect(reportedTopics(row)).toEqual(["Dizziness or balance", "Serious symptoms"]);
  });
});
