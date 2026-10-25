import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { firstName, quietLine } from "./checkinNudges";

describe("check-in nudges", () => {
  it("says how long it's been", () => {
    expect(quietLine(5, "2026-10-20T08:00:00Z")).toBe("5 days since you last spoke");
    expect(quietLine(1, "2026-10-24T08:00:00Z")).toBe("1 day since you last spoke");
    expect(quietLine(4, null)).toBe("Not in touch yet (4 days)");
  });

  it("uses the first name", () => {
    expect(firstName("Nancy  Smith")).toBe("Nancy");
    expect(firstName("")).toBe("them");
  });
});
