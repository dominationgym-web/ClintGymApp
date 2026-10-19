// Linking the phone's health app (0116, GRIZZ, 2026-10-18): Apple Health on
// iPhones, Health Connect on Android. Both need native code, so this only
// works in an app built after this was added, never in Expo Go or an older
// build. The native libraries are loaded lazily and any failure means "not
// available here", so older apps that get this as an instant update carry on.
//
// Once linked, finished workouts are read each time the Exercises tab opens
// and saved as Other exercise (src/lib/healthSync.ts), and the last nights'
// sleep is read each time the app opens (0124, src/lib/sleepSync.ts). The link
// and the last workout saved are kept on the phone.
import { Linking, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { activityFromWorkout, syncFrom, type HealthSource, type HealthWorkout } from "@/lib/healthSync";
import { applePieceKind, healthConnectStageKind, nightsFromPieces, type SleepPiece } from "@/lib/sleepSync";

type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");
type HealthConnectModule = typeof import("react-native-health-connect");

const HEART_RATE = "HKQuantityTypeIdentifierHeartRate";
const SLEEP = "HKCategoryTypeIdentifierSleepAnalysis";
const HEALTH_CONNECT_APP = "com.google.android.apps.healthdata";

let healthKit: HealthKitModule | null | undefined;
let healthConnect: HealthConnectModule | null | undefined;

function loadHealthKit(): HealthKitModule | null {
  if (healthKit !== undefined) return healthKit;
  healthKit = null;
  if (Platform.OS !== "ios" || isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    healthKit = require("@kingstinct/react-native-healthkit") as HealthKitModule;
  } catch {
    healthKit = null;
  }
  return healthKit;
}

function loadHealthConnect(): HealthConnectModule | null {
  if (healthConnect !== undefined) return healthConnect;
  healthConnect = null;
  if (Platform.OS !== "android" || isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    healthConnect = require("react-native-health-connect") as HealthConnectModule;
  } catch {
    healthConnect = null;
  }
  return healthConnect;
}

/** Which health app this phone has, or null when this app can't reach one (Expo Go, an older build, a web browser). */
export function healthSourceHere(): HealthSource | null {
  if (Platform.OS === "ios") {
    const hk = loadHealthKit();
    try {
      return hk && hk.isHealthDataAvailable() ? "apple_health" : null;
    } catch {
      return null;
    }
  }
  if (Platform.OS === "android") return loadHealthConnect() ? "health_connect" : null;
  return null;
}

// sleepAsked: the phone has asked for sleep, which was added after the first
// links (0124). sleptSince: nights are read again from here, so a night that
// grows while the watch syncs is updated.
type LinkState = { source: HealthSource; lastEnd: string | null; sleepAsked?: boolean; sleptSince?: string | null };
const key = (clientId: string) => `health-link:${clientId}`;

export async function getHealthLink(clientId: string): Promise<LinkState | null> {
  try {
    const raw = await AsyncStorage.getItem(key(clientId));
    return raw ? (JSON.parse(raw) as LinkState) : null;
  } catch {
    return null;
  }
}

async function saveLink(clientId: string, state: LinkState | null) {
  if (state) await AsyncStorage.setItem(key(clientId), JSON.stringify(state));
  else await AsyncStorage.removeItem(key(clientId));
}

export async function unlinkHealth(clientId: string) {
  await saveLink(clientId, null);
}

export type LinkResult = "linked" | "unavailable" | "needs_app" | "denied";

/** Asks the phone for permission to read workouts, heart rate, distance and sleep. */
export async function linkHealth(clientId: string): Promise<LinkResult> {
  const source = healthSourceHere();
  if (!source) return "unavailable";
  try {
    if (source === "apple_health") {
      const hk = loadHealthKit()!;
      // Apple never says whether reading was allowed; an empty read just finds nothing.
      await hk.requestAuthorization({ toRead: ["HKWorkoutTypeIdentifier", HEART_RATE, "HKQuantityTypeIdentifierDistanceWalkingRunning", SLEEP] });
    } else {
      const hc = loadHealthConnect()!;
      const status = await hc.getSdkStatus();
      if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return "needs_app";
      if (!(await hc.initialize())) return "needs_app";
      const granted = await hc.requestPermission([
        { accessType: "read", recordType: "ExerciseSession" },
        { accessType: "read", recordType: "HeartRate" },
        { accessType: "read", recordType: "Distance" },
        { accessType: "read", recordType: "SleepSession" },
      ]);
      if (!granted.some((p) => p.recordType === "ExerciseSession")) return "denied";
    }
  } catch {
    return "unavailable";
  }
  const existing = await getHealthLink(clientId);
  const same = existing?.source === source;
  await saveLink(clientId, { source, lastEnd: same ? existing.lastEnd : null, sleepAsked: true, sleptSince: same ? existing.sleptSince : null });
  return "linked";
}

/**
 * Phones linked before sleep was added are asked once for sleep too. On
 * Android this needs a build made after 0124; an older one just says no.
 */
async function askForSleepOnce(clientId: string, link: LinkState): Promise<LinkState> {
  if (link.sleepAsked) return link;
  try {
    if (link.source === "apple_health") {
      await loadHealthKit()?.requestAuthorization({ toRead: [SLEEP] });
    } else {
      const hc = loadHealthConnect();
      if (hc && (await hc.initialize())) await hc.requestPermission([{ accessType: "read", recordType: "SleepSession" }]);
    }
  } catch {
    // Not allowed or not available: sleep just won't come in.
  }
  const next = { ...link, sleepAsked: true };
  await saveLink(clientId, next);
  return next;
}

/** Opens the Play Store on Health Connect, for older Android phones that don't have it built in. */
export function openHealthConnectInStore() {
  Linking.openURL(`market://details?id=${HEALTH_CONNECT_APP}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_APP}`),
  );
}

async function readAppleWorkouts(from: Date): Promise<HealthWorkout[]> {
  const hk = loadHealthKit();
  if (!hk) return [];
  const workouts = await hk.queryWorkoutSamples({ limit: 0, ascending: true, filter: { date: { startDate: from, strictStartDate: true } } });
  const out: HealthWorkout[] = [];
  for (const w of workouts) {
    let avgHr: number | null = null;
    try {
      avgHr = (await w.getStatistic(HEART_RATE, "count/min"))?.averageQuantity?.quantity ?? null;
    } catch {
      avgHr = null;
    }
    const d = w.totalDistance;
    const km = d ? (d.unit === "km" ? d.quantity : d.unit === "mi" ? d.quantity * 1.609344 : d.unit === "m" ? d.quantity / 1000 : null) : null;
    out.push({ source: "apple_health", id: w.uuid, type: Number(w.workoutActivityType), start: new Date(w.startDate), end: new Date(w.endDate), distanceKm: km, avgHr });
  }
  return out;
}

async function readHealthConnectWorkouts(from: Date): Promise<HealthWorkout[]> {
  const hc = loadHealthConnect();
  if (!hc || !(await hc.initialize())) return [];
  const out: HealthWorkout[] = [];
  let pageToken: string | undefined;
  do {
    const page = await hc.readRecords("ExerciseSession", {
      timeRangeFilter: { operator: "after", startTime: from.toISOString() },
      ascendingOrder: true,
      pageToken,
    });
    for (const s of page.records) {
      const range = { operator: "between" as const, startTime: s.startTime, endTime: s.endTime };
      const [hr, distance] = await Promise.all([
        hc.aggregateRecord({ recordType: "HeartRate", timeRangeFilter: range }).catch(() => null),
        hc.aggregateRecord({ recordType: "Distance", timeRangeFilter: range }).catch(() => null),
      ]);
      out.push({
        source: "health_connect",
        id: s.metadata?.id ?? `${s.startTime}-${s.exerciseType}`,
        type: s.exerciseType,
        start: new Date(s.startTime),
        end: new Date(s.endTime),
        title: s.title ?? null,
        distanceKm: distance?.DISTANCE?.inKilometers ?? null,
        avgHr: hr && hr.MEASUREMENTS_COUNT > 0 ? hr.BPM_AVG : null,
      });
    }
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return out;
}

async function readAppleSleep(from: Date): Promise<SleepPiece[]> {
  const hk = loadHealthKit();
  if (!hk) return [];
  const samples = await hk.queryCategorySamples(SLEEP, { limit: 0, ascending: true, filter: { date: { startDate: from } } });
  const out: SleepPiece[] = [];
  for (const s of samples) {
    const kind = applePieceKind(Number(s.value));
    if (kind) out.push({ kind, start: new Date(s.startDate), end: new Date(s.endDate) });
  }
  return out;
}

async function readHealthConnectSleep(from: Date): Promise<SleepPiece[]> {
  const hc = loadHealthConnect();
  if (!hc || !(await hc.initialize())) return [];
  const out: SleepPiece[] = [];
  let pageToken: string | undefined;
  do {
    const page = await hc.readRecords("SleepSession", {
      timeRangeFilter: { operator: "after", startTime: from.toISOString() },
      ascendingOrder: true,
      pageToken,
    });
    for (const r of page.records) {
      const stages = (r.stages ?? [])
        .map((st) => ({ kind: healthConnectStageKind(st.stage), start: new Date(st.startTime), end: new Date(st.endTime) }))
        .filter((p): p is SleepPiece => p.kind !== null);
      // The session itself gives bed and wake times; without stages it is all sleep.
      out.push({ kind: stages.some((p) => p.kind === "asleep") ? "in_bed" : "asleep", start: new Date(r.startTime), end: new Date(r.endTime) });
      out.push(...stages);
    }
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return out;
}

/** Midday `days` days ago on the phone's clock, so each night is read whole. */
function middayDaysAgo(days: number, now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12, 0, 0, 0);
}

/**
 * Saves the last nights' sleep from the health app (0124). The first time it
 * goes back 14 nights; after that it rereads from the night before the last
 * one saved, since the watch can sync a night late. Returns the nights saved,
 * or null when the phone isn't linked.
 */
export async function syncHealthSleep(clientId: string): Promise<number | null> {
  let link = await getHealthLink(clientId);
  if (!link || healthSourceHere() !== link.source) return null;
  try {
    link = await askForSleepOnce(clientId, link);
    const now = new Date();
    const since = link.sleptSince ? new Date(link.sleptSince) : null;
    const from = since && !Number.isNaN(since.getTime()) && since > middayDaysAgo(14, now) ? since : middayDaysAgo(14, now);
    const pieces = (link.source === "apple_health" ? await readAppleSleep(from) : await readHealthConnectSleep(from)).filter(
      (p) => p.end.getTime() <= now.getTime(),
    );
    const nights = nightsFromPieces(clientId, link.source, pieces);
    if (nights.length > 0) {
      const { error } = await supabase
        .from("client_sleep")
        .upsert(
          nights.map((n) => ({ ...n, updated_at: now.toISOString() })),
          { onConflict: "client_id,sleep_date" },
        );
      if (error) return 0;
    }
    await saveLink(clientId, { ...link, sleptSince: middayDaysAgo(2, now).toISOString() });
    return nights.length;
  } catch {
    return 0;
  }
}

// Opening the app reads sleep and workouts once; a second call while that is
// running, or within 10 minutes, shares the same reading.
let openSync: { clientId: string; at: number; done: Promise<void> } | null = null;

/** Reads sleep and new workouts from the health app when the client opens the app. */
export function syncHealthOnOpen(clientId: string): Promise<void> {
  if (openSync && openSync.clientId === clientId && Date.now() - openSync.at < 10 * 60 * 1000) return openSync.done;
  const done = (async () => {
    await syncHealthSleep(clientId);
    await syncHealthWorkouts(clientId);
  })().catch(() => undefined);
  openSync = { clientId, at: Date.now(), done };
  return done;
}

/**
 * Saves new workouts from the health app as Other exercise. Returns how many
 * were added, or null when the phone isn't linked. A workout already saved is
 * skipped (0116's unique external_id), and one the client removed isn't read
 * again because reading starts after the last workout saved.
 */
export async function syncHealthWorkouts(clientId: string): Promise<number | null> {
  const link = await getHealthLink(clientId);
  if (!link || healthSourceHere() !== link.source) return null;
  try {
    const from = syncFrom(link.lastEnd, new Date());
    const workouts = (link.source === "apple_health" ? await readAppleWorkouts(from) : await readHealthConnectWorkouts(from)).filter(
      (w) => w.end.getTime() <= Date.now(),
    );
    if (workouts.length === 0) return 0;
    const rows = workouts.map((w) => activityFromWorkout(clientId, w)).filter((r) => r !== null);
    let added = 0;
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("client_activities")
        .upsert(rows, { onConflict: "client_id,external_id", ignoreDuplicates: true })
        .select("id");
      if (error) return 0;
      added = data?.length ?? 0;
    }
    const lastEnd = new Date(Math.max(...workouts.map((w) => w.end.getTime()))).toISOString();
    // Read again: the sleep reading may have saved its own fields meanwhile.
    const current = await getHealthLink(clientId);
    await saveLink(clientId, { ...(current ?? link), lastEnd });
    return added;
  } catch {
    return 0;
  }
}
