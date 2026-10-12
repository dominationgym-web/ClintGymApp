import { describe, expect, it } from "vitest";
import { problemColor, problemLevel, problemLine, unfixedByClient } from "./clientProblems";

describe("problemLevel", () => {
  it("is red while anything is open", () => {
    expect(problemLevel([{ status: "fixing" }, { status: "open" }])).toBe("red");
  });
  it("is orange once everything left is being fixed", () => {
    expect(problemLevel([{ status: "fixing" }, { status: "fixed" }])).toBe("orange");
  });
  it("has no dot when all are fixed or there are none", () => {
    expect(problemLevel([{ status: "fixed" }])).toBeNull();
    expect(problemLevel([])).toBeNull();
    expect(problemColor(null)).toBeUndefined();
  });
});

describe("unfixedByClient", () => {
  it("groups by client and drops fixed problems", () => {
    const map = unfixedByClient([
      { client_id: "a", status: "open" as const },
      { client_id: "a", status: "fixed" as const },
      { client_id: "b", status: "fixed" as const },
    ]);
    expect(map.get("a")?.length).toBe(1);
    expect(map.has("b")).toBe(false);
  });
});

describe("problemLine", () => {
  it("names the topic and detail", () => {
    expect(problemLine({ topic: "pain", detail: "Knee: sore", status: "open" })).toBe("🩹 Pain or injury: Knee: sore");
  });
  it("shows a flag's own wording", () => {
    expect(problemLine({ topic: "flag", detail: "Urgent - needs guidance: help", status: "open" })).toBe(
      "🚩 Urgent - needs guidance: help"
    );
  });
  it("says Busy fixing", () => {
    expect(problemLine({ topic: "fatigue", detail: "", status: "fixing" })).toBe("🟠 Busy fixing · Fatigue");
  });
});
