import { describe, expect, it } from "vitest";
import { EMPTY_WELLBEING, reportedTopics, reportsByTopic, validateWellbeing, type WellbeingForm } from "@/lib/wellbeing";
import type { Checkin } from "@/types/database";

const ok = { status: "ok" as const, kind: "", notes: "" };
const allOk: WellbeingForm = { pain: ok, fatigue: ok, mental: ok };

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
