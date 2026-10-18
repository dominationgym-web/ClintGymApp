import { describe, expect, it } from "vitest";
import { activityFromWorkout, kindForWorkout, syncFrom, type HealthWorkout } from "@/lib/healthSync";

const start = new Date(2026, 9, 18, 6, 0);
const workout = (over: Partial<HealthWorkout>): HealthWorkout => ({
  source: "health_connect",
  id: "abc",
  type: 56,
  start,
  end: new Date(start.getTime() + 42 * 60000),
  ...over,
});

describe("kindForWorkout", () => {
  it("maps runs, rides and walks on both phones", () => {
    expect(kindForWorkout("apple_health", 37)).toEqual({ kind: "run" });
    expect(kindForWorkout("health_connect", 56)).toEqual({ kind: "run" });
    expect(kindForWorkout("apple_health", 13)).toEqual({ kind: "cycle" });
    expect(kindForWorkout("health_connect", 79)).toEqual({ kind: "walk" });
  });

  it("skips gym sessions, which the app's own workouts cover", () => {
    expect(kindForWorkout("apple_health", 50)).toBe("skip");
    expect(kindForWorkout("health_connect", 70)).toBe("skip");
  });

  it("calls anything unknown other", () => {
    expect(kindForWorkout("apple_health", 999)).toEqual({ kind: "other" });
  });
});

describe("activityFromWorkout", () => {
  it("makes an Other exercise row with distance and heart rate", () => {
    expect(activityFromWorkout("c1", workout({ distanceKm: 8.4567, avgHr: 151.6 }))).toEqual({
      client_id: "c1",
      activity_date: "2026-10-18",
      kind: "run",
      name: null,
      minutes: 42,
      distance_km: 8.46,
      avg_hr: 152,
      source: "health_connect",
      external_id: "health_connect:abc",
    });
  });

  it("keeps the watch's own name, and names sports", () => {
    expect(activityFromWorkout("c1", workout({ title: "Parkrun" }))?.name).toBe("Parkrun");
    expect(activityFromWorkout("c1", workout({ type: 64 }))).toMatchObject({ kind: "sport", name: "Soccer" });
    expect(activityFromWorkout("c1", workout({ title: "Run" }))?.name).toBeNull();
  });

  it("drops distance for sports and heart rates that can't be right", () => {
    const row = activityFromWorkout("c1", workout({ type: 64, distanceKm: 6, avgHr: 12 }));
    expect(row?.distance_km).toBeNull();
    expect(row?.avg_hr).toBeNull();
  });

  it("skips gym sessions and watches started by mistake", () => {
    expect(activityFromWorkout("c1", workout({ type: 70 }))).toBeNull();
    expect(activityFromWorkout("c1", workout({ end: new Date(start.getTime() + 3 * 60000) }))).toBeNull();
  });
});

describe("syncFrom", () => {
  const now = new Date(2026, 9, 18, 12, 0);
  it("reads the last 2 weeks on the first link", () => {
    expect(syncFrom(null, now).getTime()).toBe(now.getTime() - 14 * 86400000);
  });
  it("carries on after the last workout saved", () => {
    const last = new Date(2026, 9, 17, 7, 0).toISOString();
    expect(syncFrom(last, now).toISOString()).toBe(last);
  });
  it("never goes further back than 2 weeks", () => {
    expect(syncFrom(new Date(2026, 8, 1).toISOString(), now).getTime()).toBe(now.getTime() - 14 * 86400000);
  });
});
