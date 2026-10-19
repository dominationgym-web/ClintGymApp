import { describe, expect, it } from "vitest";
import { applePieceKind, clockTime, coveredMinutes, healthConnectStageKind, nightOf, nightsFromPieces, sleepLength, type SleepPiece } from "@/lib/sleepSync";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const piece = (kind: SleepPiece["kind"], start: Date, end: Date): SleepPiece => ({ kind, start, end });

describe("piece kinds", () => {
  it("reads Apple Health sleep values", () => {
    expect(applePieceKind(0)).toBe("in_bed");
    expect(applePieceKind(2)).toBe("awake");
    expect([1, 3, 4, 5].map(applePieceKind)).toEqual(["asleep", "asleep", "asleep", "asleep"]);
    expect(applePieceKind(9)).toBeNull();
  });

  it("reads Health Connect stages", () => {
    expect([1, 3, 7].map(healthConnectStageKind)).toEqual(["awake", "awake", "awake"]);
    expect([2, 4, 5, 6].map(healthConnectStageKind)).toEqual(["asleep", "asleep", "asleep", "asleep"]);
    expect(healthConnectStageKind(0)).toBeNull();
  });
});

describe("nightOf", () => {
  it("puts a night on the morning the client woke up", () => {
    expect(nightOf(at(18, 22, 30))).toBe("2026-10-19");
    expect(nightOf(at(19, 1, 15))).toBe("2026-10-19");
  });
});

describe("coveredMinutes", () => {
  it("counts overlapping pieces once", () => {
    expect(coveredMinutes([{ start: at(18, 23), end: at(19, 3) }, { start: at(19, 2), end: at(19, 6) }])).toBe(7 * 60);
  });

  it("adds separate pieces", () => {
    expect(coveredMinutes([{ start: at(18, 23), end: at(19, 1) }, { start: at(19, 2), end: at(19, 6) }])).toBe(6 * 60);
  });
});

describe("nightsFromPieces", () => {
  it("makes one row per night from asleep and awake pieces", () => {
    const nights = nightsFromPieces("c1", "apple_health", [
      piece("in_bed", at(18, 22, 30), at(19, 6, 15)),
      piece("asleep", at(18, 23), at(19, 3)),
      piece("awake", at(19, 3), at(19, 3, 20)),
      piece("asleep", at(19, 3, 20), at(19, 6)),
    ]);
    expect(nights).toEqual([
      {
        client_id: "c1",
        sleep_date: "2026-10-19",
        bed_at: at(18, 22, 30).toISOString(),
        wake_at: at(19, 6, 15).toISOString(),
        asleep_minutes: 6 * 60 + 40,
        awake_minutes: 20,
        source: "apple_health",
      },
    ]);
  });

  it("uses time in bed when there are no asleep pieces", () => {
    const [night] = nightsFromPieces("c1", "apple_health", [piece("in_bed", at(18, 23), at(19, 6))]);
    expect(night.asleep_minutes).toBe(7 * 60);
  });

  it("leaves out short naps and splits separate nights", () => {
    const nights = nightsFromPieces("c1", "health_connect", [
      piece("asleep", at(17, 22), at(18, 5)),
      piece("asleep", at(18, 22), at(19, 6)),
      piece("asleep", at(19, 13), at(19, 13, 40)),
    ]);
    expect(nights.map((n) => [n.sleep_date, n.asleep_minutes])).toEqual([
      ["2026-10-18", 7 * 60],
      ["2026-10-19", 8 * 60],
    ]);
  });
});

describe("formatting", () => {
  it("writes sleep length and clock time", () => {
    expect(sleepLength(440)).toBe("7 h 20 min");
    expect(sleepLength(480)).toBe("8 h");
    expect(clockTime(at(18, 22, 5).toISOString())).toBe("22:05");
  });
});
