import { describe, expect, it } from "vitest";
import { activityDetails, activityPace, activityTitle, isBigActivity, parseActivityForm } from "./otherActivities";

describe("otherActivities", () => {
  it("names and describes an activity", () => {
    expect(activityTitle({ kind: "sport", name: " Padel " })).toBe("Padel");
    expect(activityTitle({ kind: "run", name: null })).toBe("Run");
    expect(activityDetails({ minutes: 45, distance_km: 5.2, avg_hr: 142, effort: "hard" })).toBe("45 min · 5.2 km · 142 bpm · Hard");
    expect(activityDetails({ minutes: 30, distance_km: null, avg_hr: null, effort: null })).toBe("30 min");
  });

  it("works out the pace for runs and walks", () => {
    expect(activityPace({ kind: "run", minutes: 27.5, distance_km: 5 })).toBe("5:30 /km");
    expect(activityPace({ kind: "cycle", minutes: 60, distance_km: 25 })).toBeNull();
    expect(activityPace({ kind: "run", minutes: 30, distance_km: null })).toBeNull();
  });

  it("reads the form", () => {
    expect(parseActivityForm({ minutes: "40", distance: "5,2", hr: "" })).toEqual({ ok: true, minutes: 40, distance_km: 5.2, avg_hr: null });
    expect(parseActivityForm({ minutes: "", distance: "", hr: "" }).ok).toBe(false);
    expect(parseActivityForm({ minutes: "30", distance: "abc", hr: "" }).ok).toBe(false);
    expect(parseActivityForm({ minutes: "30", distance: "", hr: "300" }).ok).toBe(false);
  });

  it("counts long or hard sessions as big", () => {
    expect(isBigActivity({ minutes: 60, effort: "easy" })).toBe(true);
    expect(isBigActivity({ minutes: 20, effort: "hard" })).toBe(true);
    expect(isBigActivity({ minutes: 30, effort: "easy" })).toBe(false);
  });
});
