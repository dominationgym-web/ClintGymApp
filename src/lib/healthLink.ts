// Linking the phone's health app (0116, GRIZZ, 2026-10-18): Apple Health on
// iPhones, Health Connect on Android. Both need native code, so this only
// works in an app built after this was added, never in Expo Go or an older
// build. The native libraries are loaded lazily and any failure means "not
// available here", so older apps that get this as an instant update carry on.
//
// Once linked, finished workouts are read each time the Exercises tab opens
// and saved as Other exercise (src/lib/healthSync.ts). The link and the last
// workout saved are kept on the phone.
import { Linking, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { activityFromWorkout, syncFrom, type HealthSource, type HealthWorkout } from "@/lib/healthSync";

type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");
type HealthConnectModule = typeof import("react-native-health-connect");

const HEART_RATE = "HKQuantityTypeIdentifierHeartRate";
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

type LinkState = { source: HealthSource; lastEnd: string | null };
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

/** Asks the phone for permission to read workouts, heart rate and distance. */
export async function linkHealth(clientId: string): Promise<LinkResult> {
  const source = healthSourceHere();
  if (!source) return "unavailable";
  try {
    if (source === "apple_health") {
      const hk = loadHealthKit()!;
      // Apple never says whether reading was allowed; an empty read just finds nothing.
      await hk.requestAuthorization({ toRead: ["HKWorkoutTypeIdentifier", HEART_RATE, "HKQuantityTypeIdentifierDistanceWalkingRunning"] });
    } else {
      const hc = loadHealthConnect()!;
      const status = await hc.getSdkStatus();
      if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return "needs_app";
      if (!(await hc.initialize())) return "needs_app";
      const granted = await hc.requestPermission([
        { accessType: "read", recordType: "ExerciseSession" },
        { accessType: "read", recordType: "HeartRate" },
        { accessType: "read", recordType: "Distance" },
      ]);
      if (!granted.some((p) => p.recordType === "ExerciseSession")) return "denied";
    }
  } catch {
    return "unavailable";
  }
  const existing = await getHealthLink(clientId);
  await saveLink(clientId, { source, lastEnd: existing?.source === source ? existing.lastEnd : null });
  return "linked";
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
    await saveLink(clientId, { source: link.source, lastEnd });
    return added;
  } catch {
    return 0;
  }
}
