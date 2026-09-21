import { describe, expect, it } from "vitest";
import { clientPriority, flagBorderColor, type FlagRow } from "@/lib/clientFlags";

function row(overrides: Partial<FlagRow> = {}): FlagRow {
  return { statusFlag: "green", distressFlag: false, hasCheckedInToday: true, ...overrides };
}

describe("clientPriority", () => {
  it("puts an urgent red flag above everything else", () => {
    expect(clientPriority(row({ statusFlag: "red" }))).toBe(0);
    // Even a client who has done everything else right.
    expect(clientPriority(row({ statusFlag: "red", distressFlag: true, hasCheckedInToday: true }))).toBe(0);
  });

  it("puts distress flagged today above a wants-feedback flag", () => {
    expect(clientPriority(row({ distressFlag: true }))).toBeLessThan(clientPriority(row({ statusFlag: "orange" })));
  });

  it("puts a wants-feedback flag above a missing check-in", () => {
    expect(clientPriority(row({ statusFlag: "orange" }))).toBeLessThan(
      clientPriority(row({ hasCheckedInToday: false }))
    );
  });

  it("puts a missing check-in above a client who is all done", () => {
    expect(clientPriority(row({ hasCheckedInToday: false }))).toBeLessThan(clientPriority(row()));
  });

  it("sorts a mixed list into the trainer's expected order", () => {
    const rows: Array<[string, FlagRow]> = [
      ["done", row()],
      ["no check-in", row({ hasCheckedInToday: false })],
      ["urgent", row({ statusFlag: "red" })],
      ["wants feedback", row({ statusFlag: "orange" })],
      ["distress", row({ distressFlag: true })],
    ];
    const order = rows
      .sort((a, b) => clientPriority(a[1]) - clientPriority(b[1]))
      .map(([label]) => label);
    expect(order).toEqual(["urgent", "distress", "wants feedback", "no check-in", "done"]);
  });
});

describe("flagBorderColor", () => {
  it("highlights red and orange, and leaves green plain", () => {
    expect(flagBorderColor("red")).toBe("#EF4444");
    expect(flagBorderColor("orange")).toBe("#F59E0B");
    expect(flagBorderColor("green")).toBeUndefined();
  });
});
