import { describe, expect, it } from "vitest";
import { holidayDay, holidayLength, holidayOn, holidaySpan, upcomingHolidays } from "./holidays";

const h = (holiday_from: string, holiday_until: string) => ({ id: holiday_from, reason: "", holiday_from, holiday_until });

describe("coach holidays", () => {
  it("names the days", () => {
    expect(holidayDay("2026-12-14")).toBe("Mon 14 Dec");
    expect(holidaySpan(h("2026-12-14", "2026-12-20"))).toBe("from Mon 14 Dec to Sun 20 Dec");
    expect(holidaySpan(h("2026-12-14", "2026-12-14"))).toBe("on Mon 14 Dec");
    expect(holidaySpan(h("2026-12-14", "2026-12-20"), "2026-12-16")).toBe("until Sun 20 Dec");
  });
  it("finds the day's holiday and the ones coming", () => {
    const list = [h("2026-12-14", "2026-12-20"), h("2026-11-01", "2026-11-02"), h("2027-01-05", "2027-01-06")];
    expect(holidayOn(list, "2026-12-20")?.id).toBe("2026-12-14");
    expect(holidayOn(list, "2026-12-21")).toBeNull();
    expect(upcomingHolidays(list, "2026-11-09").map((x) => x.id)).toEqual(["2026-12-14", "2027-01-05"]);
  });
  it("counts the days", () => {
    expect(holidayLength("2026-12-14", "2026-12-20")).toBe(7);
    expect(holidayLength("2026-12-31", "2027-01-01")).toBe(2);
  });
});
