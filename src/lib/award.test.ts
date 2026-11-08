import { describe, expect, it } from "vitest";
import {
  AWARD_SETTING_FIELDS,
  longDate,
  parseAwardSetting,
  proofDueText,
  trainerAwardHeadline,
  videoExtension,
  weightsWarning,
} from "@/lib/award";

const field = (key: string) => AWARD_SETTING_FIELDS.find((f) => f.key === key)!;

describe("award helpers", () => {
  it("writes dates out in full", () => {
    expect(longDate("2027-06-30")).toBe("30 June 2027");
    expect(longDate(null)).toBe("");
  });

  it("counts down the proof video days", () => {
    expect(proofDueText("2026-11-15", "2026-11-08")).toBe("Send it within 7 days");
    expect(proofDueText("2026-11-09", "2026-11-08")).toBe("Send it by tomorrow");
    expect(proofDueText("2026-11-08", "2026-11-08")).toBe("Send it today");
    expect(proofDueText("2026-11-07", "2026-11-08")).toBe("This request has closed");
  });

  it("never shows the trainer a number, and the cooldown wins", () => {
    expect(trainerAwardHeadline({ enabled: true, cooldown_until: "2027-06-30" })).toBe("Sitting out until 30 June 2027");
    expect(
      trainerAwardHeadline({ enabled: true, message: { sent_on: "2026-11-01", kind: "top", body: "You're in the top 25%", tip: null } })
    ).toBe("You're in the top 25%");
    expect(trainerAwardHeadline({ enabled: true, first_start: "2027-01-01", period_starts: null })).toBe("Starts on 1 January 2027");
  });

  it("checks what the owner types in settings", () => {
    expect(parseAwardSetting(field("cap_strength_pct"), "7,5")).toEqual({ ok: true, value: 7.5 });
    expect(parseAwardSetting(field("cap_strength_pct"), "lots").ok).toBe(false);
    expect(parseAwardSetting(field("first_period_start"), "2027-01-01")).toEqual({ ok: true, value: "2027-01-01" });
    expect(parseAwardSetting(field("first_period_start"), "1 Jan").ok).toBe(false);
    expect(parseAwardSetting(field("first_period_start"), "")).toEqual({ ok: true, value: null });
    expect(parseAwardSetting(field("stream_url"), " ")).toEqual({ ok: true, value: null });
    expect(parseAwardSetting(field("message_top"), "").ok).toBe(false);
  });

  it("warns when the weights don't add up to 100", () => {
    const ok = { signup_weight: 30, retention_weight: 20, progress_weight: 50, strength_weight: 40, bodyweight_weight: 30, measurement_weight: 30 };
    expect(weightsWarning(ok)).toBeNull();
    expect(weightsWarning({ ...ok, signup_weight: 40 })).toMatch(/110%/);
    expect(weightsWarning({ ...ok, strength_weight: 50 })).toMatch(/progress parts add up to 110%/);
  });

  it("finds a video's file type", () => {
    expect(videoExtension("file:///x/clip.MOV")).toBe("mov");
    expect(videoExtension("content://media/123", "video/mp4")).toBe("mp4");
    expect(videoExtension("content://media/123")).toBe("mp4");
  });
});
