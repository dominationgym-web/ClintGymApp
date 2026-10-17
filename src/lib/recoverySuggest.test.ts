import { describe, expect, it } from "vitest";
import { suggestRecovery, type RecoveryInputs } from "@/lib/recoverySuggest";

const today = "2026-10-17";
const sets = (date: string, n: number, effort: "comfortable" | "close_to_failure" | "failure" = "comfortable", legs = false) =>
  Array.from({ length: n }, () => ({ date, effort, groups: legs ? (["Legs"] as const).slice() : [] })) as RecoveryInputs["sets"];
const empty: RecoveryInputs = { sets: [], checkins: [], recovery: [] };
const checkin = (over: Partial<RecoveryInputs["checkins"][number]>) => ({
  date: today,
  sleepQuality: null,
  pain: false,
  painArea: null,
  fatigue: false,
  mental: false,
  ...over,
});

describe("suggestRecovery", () => {
  it("suggests nothing for a quiet week", () => {
    expect(suggestRecovery(empty, today)).toEqual([]);
  });

  it("puts pain and tiredness first", () => {
    const s = suggestRecovery({ ...empty, checkins: [checkin({ pain: true, painArea: "Lower back", fatigue: true })] }, today);
    expect(s.map((x) => x.activity)).toEqual(["stretching", "sleep"]);
    expect(s[0].reason).toContain("lower back");
  });

  it("treats poor sleep as tiredness", () => {
    expect(suggestRecovery({ ...empty, checkins: [checkin({ date: "2026-10-16", sleepQuality: 2 })] }, today)[0].activity).toBe("sleep");
  });

  it("spots a hard day and a big leg day yesterday", () => {
    const s = suggestRecovery({ ...empty, sets: sets("2026-10-16", 10, "failure", true) }, today);
    expect(s.map((x) => x.activity)).toEqual(["cold_heat", "foam_rolling"]);
  });

  it("asks for a rest day after 5 days in a row", () => {
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"].flatMap((d) => sets(d, 6));
    const s = suggestRecovery({ ...empty, sets: week }, today);
    expect(s[0].activity).toBe("rest");
    expect(s[0].reason).toContain("5 days in a row");
  });

  it("nudges stretching when there's been no recovery all week", () => {
    const week = ["2026-10-11", "2026-10-13", "2026-10-15"].flatMap((d) => sets(d, 6));
    expect(suggestRecovery({ ...empty, sets: week }, today).map((x) => x.activity)).toEqual(["stretching"]);
    const withRecovery = { ...empty, sets: week, recovery: [{ activity: "breathing", planned_on: "2026-10-14", done_on: "2026-10-14" }] };
    expect(suggestRecovery(withRecovery, today)).toEqual([]);
  });

  it("skips what's already planned or done today", () => {
    const s = suggestRecovery(
      { ...empty, checkins: [checkin({ fatigue: true })], recovery: [{ activity: "sleep", planned_on: today, done_on: null }] },
      today,
    );
    expect(s).toEqual([]);
  });
});
