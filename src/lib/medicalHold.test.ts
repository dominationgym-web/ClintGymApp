import { describe, expect, it } from "vitest";
import { clearanceProblem } from "@/lib/medicalHold";

describe("clearanceProblem", () => {
  const ready = { clearance: "medical_cleared" as const, by: "Dr Naidoo (GP)", on: "2026-10-21", checked: true };

  it("needs more than a note", () => {
    expect(clearanceProblem({ ...ready, clearance: null }, "2026-10-20", "2026-10-22")).toMatch(/how it was resolved/);
    expect(clearanceProblem({ ...ready, by: " " }, "2026-10-20", "2026-10-22")).toMatch(/who assessed/);
    expect(clearanceProblem({ ...ready, checked: false }, "2026-10-20", "2026-10-22")).toMatch(/Tick/);
  });

  it("only takes a date between the report and today", () => {
    expect(clearanceProblem({ ...ready, on: "2026-10-19" }, "2026-10-20", "2026-10-22")).toMatch(/between/);
    expect(clearanceProblem({ ...ready, on: "2026-10-23" }, "2026-10-20", "2026-10-22")).toMatch(/between/);
    expect(clearanceProblem(ready, "2026-10-20", "2026-10-22")).toBeNull();
  });
});
