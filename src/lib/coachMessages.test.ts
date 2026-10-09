import { describe, expect, it } from "vitest";
import { alertSummary, cleanMessage, MAX_MESSAGE_LENGTH, needsReply } from "@/lib/coachMessages";

describe("cleanMessage", () => {
  it("trims the message", () => {
    expect(cleanMessage("  On my way, call me at 5  ")).toBe("On my way, call me at 5");
  });

  it("refuses an empty or blank message", () => {
    expect(cleanMessage("")).toBeNull();
    expect(cleanMessage("   \n  ")).toBeNull();
  });

  it("refuses a message longer than the database allows", () => {
    expect(cleanMessage("a".repeat(MAX_MESSAGE_LENGTH))).not.toBeNull();
    expect(cleanMessage("a".repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
  });
});

describe("needsReply", () => {
  it("offers a reply for a red or orange flag, or distress today", () => {
    expect(needsReply("red", false)).toBe(true);
    expect(needsReply("orange", false)).toBe(true);
    expect(needsReply("green", true)).toBe(true);
  });

  it("doesn't for a client with nothing raised", () => {
    expect(needsReply("green", false)).toBe(false);
  });
});

describe("alertSummary", () => {
  it("names the most urgent thing first", () => {
    expect(alertSummary("red", true)).toContain("Urgent");
    expect(alertSummary("orange", true)).toContain("feedback");
    expect(alertSummary("green", true)).toContain("Distress");
    expect(alertSummary("green", false)).toBeNull();
  });
});
