// Workouts from the client's watch (0116, GRIZZ, 2026-10-18). The phone's own
// health app collects them: Apple Health on iPhones, Health Connect on Android
// (Samsung Health, Garmin Connect and Polar Flow can all sync into these). The
// app reads finished workouts and saves each as Other exercise (0114). This
// file turns a workout into a client_activities row; src/lib/healthLink.ts
// talks to the phone.
import { toIsoDate } from "@/lib/dates";
import { findActivityKind, type ActivityKind } from "@/lib/otherActivities";

export type HealthSource = "apple_health" | "health_connect";

/** A finished workout as the phone's health app has it. */
export type HealthWorkout = {
  source: HealthSource;
  /** The workout's id in the health app, so it is only saved once. */
  id: string;
  /** The health app's workout type number. */
  type: number;
  start: Date;
  end: Date;
  /** The name the watch gave it, when there is one. */
  title?: string | null;
  distanceKm?: number | null;
  avgHr?: number | null;
};

export type SyncedActivity = {
  client_id: string;
  activity_date: string;
  kind: ActivityKind;
  name: string | null;
  minutes: number;
  distance_km: number | null;
  avg_hr: number | null;
  source: HealthSource;
  external_id: string;
};

// Gym sessions are left out: the client logs those in the app's own workouts,
// so they would count twice.
const SKIP = "skip" as const;
type Mapped = { kind: ActivityKind; name?: string } | typeof SKIP;

// HKWorkoutActivityType numbers.
const APPLE: Record<number, Mapped> = {
  13: { kind: "cycle" },
  24: { kind: "hike" },
  37: { kind: "run" },
  46: { kind: "swim" },
  52: { kind: "walk" },
  20: SKIP, // functional strength training
  50: SKIP, // traditional strength training
  59: SKIP, // core training
  41: { kind: "sport", name: "Soccer" },
  36: { kind: "sport", name: "Rugby" },
  48: { kind: "sport", name: "Tennis" },
  31: { kind: "sport", name: "Paddling" },
  8: { kind: "sport", name: "Boxing" },
  9: { kind: "sport", name: "Climbing" },
  10: { kind: "sport", name: "Cricket" },
  16: { kind: "other", name: "Elliptical" },
  35: { kind: "other", name: "Rowing" },
  57: { kind: "other", name: "Yoga" },
  63: { kind: "other", name: "HIIT" },
  28: { kind: "other", name: "Martial arts" },
  66: { kind: "other", name: "Pilates" },
};

// Health Connect ExerciseSessionRecord exercise types.
const HEALTH_CONNECT: Record<number, Mapped> = {
  8: { kind: "cycle" },
  9: { kind: "cycle", name: "Indoor cycle" },
  37: { kind: "hike" },
  56: { kind: "run" },
  57: { kind: "run", name: "Treadmill run" },
  73: { kind: "swim", name: "Open water swim" },
  74: { kind: "swim" },
  79: { kind: "walk" },
  13: SKIP, // calisthenics
  70: SKIP, // strength training
  81: SKIP, // weightlifting
  64: { kind: "sport", name: "Soccer" },
  55: { kind: "sport", name: "Rugby" },
  76: { kind: "sport", name: "Tennis" },
  11: { kind: "sport", name: "Boxing" },
  51: { kind: "sport", name: "Climbing" },
  14: { kind: "sport", name: "Cricket" },
  25: { kind: "other", name: "Elliptical" },
  53: { kind: "other", name: "Rowing" },
  54: { kind: "other", name: "Rowing machine" },
  83: { kind: "other", name: "Yoga" },
  36: { kind: "other", name: "HIIT" },
  44: { kind: "other", name: "Martial arts" },
  48: { kind: "other", name: "Pilates" },
};

/** The app's kind for a health app workout type, or "skip" for gym sessions. */
export function kindForWorkout(source: HealthSource, type: number): Mapped {
  return (source === "apple_health" ? APPLE : HEALTH_CONNECT)[type] ?? { kind: "other" };
}

/**
 * The Other exercise row for a workout, or null when it isn't one to save:
 * a gym session, or shorter than 5 minutes (a watch started by mistake).
 */
export function activityFromWorkout(clientId: string, w: HealthWorkout): SyncedActivity | null {
  const mapped = kindForWorkout(w.source, w.type);
  if (mapped === SKIP) return null;
  const minutes = Math.round((w.end.getTime() - w.start.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 5) return null;
  const title = w.title?.trim() || mapped.name || null;
  const km = Number(w.distanceKm);
  const hr = Math.round(Number(w.avgHr));
  return {
    client_id: clientId,
    activity_date: toIsoDate(w.start),
    kind: mapped.kind,
    name: title && title !== findActivityKind(mapped.kind).label ? title.slice(0, 60) : null,
    minutes: Math.min(minutes, 1440),
    distance_km: findActivityKind(mapped.kind).distance && km > 0 && km <= 1000 ? Math.round(km * 100) / 100 : null,
    avg_hr: hr >= 30 && hr <= 230 ? hr : null,
    source: w.source,
    external_id: `${w.source}:${w.id}`.slice(0, 200),
  };
}

/** Where to start reading: just after the last workout saved, or 14 days back on the first link. */
export function syncFrom(lastEnd: string | null, now: Date): Date {
  const twoWeeks = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last = lastEnd ? new Date(lastEnd) : null;
  return last && !Number.isNaN(last.getTime()) && last > twoWeeks ? last : twoWeeks;
}

export function healthAppName(source: HealthSource): string {
  return source === "apple_health" ? "Apple Health" : "Health Connect";
}
