import { describe, expect, it } from "vitest";
import { injuryCheckDue, injuryCheckWhen } from "./injuryCheck";

const base = { created_at: "2026-11-01T08:00:00", last_check_on: null, healed_on: null };

describe("injuryCheckDue", () => {
  it("waits a week after the injury is added", () => {
    expect(injuryCheckDue(base, "2026-11-07")).toBe(false);
    expect(injuryCheckDue(base, "2026-11-08")).toBe(true);
  });
  it("asks again a week after the last answer", () => {
    const answered = { ...base, last_check_on: "2026-11-09" };
    expect(injuryCheckDue(answered, "2026-11-10")).toBe(false);
    expect(injuryCheckDue(answered, "2026-11-16")).toBe(true);
  });
  it("never asks about a healed injury", () => {
    expect(injuryCheckDue({ ...base, healed_on: "2026-11-05" }, "2026-12-01")).toBe(false);
  });
});

describe("injuryCheckWhen", () => {
  it("says this week, last week or weeks ago", () => {
    expect(injuryCheckWhen("2026-11-09", "2026-11-10")).toBe("this week");
    expect(injuryCheckWhen("2026-11-02", "2026-11-10")).toBe("last week");
    expect(injuryCheckWhen("2026-10-20", "2026-11-10")).toBe("3 weeks ago");
  });
});
