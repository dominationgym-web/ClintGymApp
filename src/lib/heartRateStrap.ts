// Live heart rate from a Bluetooth chest strap, arm band or a watch that
// broadcasts its heart rate (GRIZZ, 2026-11-25). They all speak the standard
// Bluetooth Heart Rate service (0x180D), so one connection works for Polar,
// Garmin, Wahoo, Coospo, and Garmin / Polar / Coros / Suunto / Amazfit watches
// with heart rate broadcast turned on. Apple Watch can't broadcast: that needs
// a watch app of its own, still to come.
//
// This needs native Bluetooth code, so it only works in an app built after it
// was added, never in Expo Go, an older build or the website. The library is
// loaded lazily and any failure means "not here", so older apps that get this
// as an instant update show a "comes with the next app update" note instead.
import { PermissionsAndroid, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseHeartRateBase64 } from "@/lib/heartRateMeasurement";

type BlePlx = typeof import("react-native-ble-plx");
type Manager = InstanceType<BlePlx["BleManager"]>;

export const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
export const HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";
const LAST_DEVICE_KEY = "hr-strap-last";

let manager: Manager | null | undefined;

function loadManager(): Manager | null {
  if (manager !== undefined) return manager;
  // Screenshot and video harnesses hand in a pretend strap here.
  const pretend = (globalThis as { __pretendHeartRateManager?: Manager }).__pretendHeartRateManager;
  if (pretend) return (manager = pretend);
  manager = null;
  if (Platform.OS === "web" || isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ble = require("react-native-ble-plx") as BlePlx;
    manager = new ble.BleManager();
  } catch {
    manager = null;
  }
  return manager;
}

/** True when this app can talk to a strap (a new enough build on a phone). */
export function strapSupported(): boolean {
  return loadManager() != null;
}

async function askPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const version = typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version);
  try {
    if (version >= 31) {
      const got = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(got).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    const got = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return got === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export type FoundStrap = { id: string; name: string };
export type ScanProblem = "not_here" | "permission" | "bluetooth_off" | "failed";

/**
 * Looks for heart rate straps and watches nearby. Calls onFound for each one
 * (once per device) and returns a stop function.
 */
export async function scanForStraps(onFound: (s: FoundStrap) => void, onProblem: (p: ScanProblem) => void): Promise<() => void> {
  const m = loadManager();
  const none = () => undefined;
  if (!m) {
    onProblem("not_here");
    return none;
  }
  if (!(await askPermission())) {
    onProblem("permission");
    return none;
  }
  const state = await m.state().catch(() => "Unknown");
  if (state === "PoweredOff") {
    onProblem("bluetooth_off");
    return none;
  }
  const seen = new Set<string>();
  try {
    await m.startDeviceScan([HR_SERVICE], null, async (error, device) => {
      if (error) {
        onProblem(String(error.message ?? "").toLowerCase().includes("powered off") ? "bluetooth_off" : "failed");
        return;
      }
      if (!device || seen.has(device.id)) return;
      seen.add(device.id);
      onFound({ id: device.id, name: device.localName || device.name || "Heart rate monitor" });
    });
  } catch {
    onProblem("failed");
    return none;
  }
  return () => {
    m.stopDeviceScan().catch(() => undefined);
  };
}

export type StrapConnection = { disconnect: () => void };

/**
 * Connects and calls onHeartRate with each reading (about once a second).
 * onLost is called if the strap drops out (out of range, battery, taken off).
 */
export async function connectStrap(
  strap: FoundStrap,
  onHeartRate: (bpm: number) => void,
  onLost: () => void,
): Promise<StrapConnection | null> {
  const m = loadManager();
  if (!m) return null;
  try {
    await m.stopDeviceScan().catch(() => undefined);
    const device = await m.connectToDevice(strap.id, { timeout: 15000 });
    await device.discoverAllServicesAndCharacteristics();
    let ended = false;
    const lost = m.onDeviceDisconnected(strap.id, () => {
      if (!ended) onLost();
    });
    const sub = device.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT, (error, ch) => {
      if (error) return;
      const bpm = parseHeartRateBase64(ch?.value);
      if (bpm != null) onHeartRate(bpm);
    });
    AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(strap)).catch(() => undefined);
    return {
      disconnect: () => {
        ended = true;
        sub.remove();
        lost.remove();
        m.cancelDeviceConnection(strap.id).catch(() => undefined);
      },
    };
  } catch {
    return null;
  }
}

/** The strap or watch used last time, so it can be connected in one tap. */
export async function lastStrap(): Promise<FoundStrap | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_DEVICE_KEY);
    const s = raw ? (JSON.parse(raw) as FoundStrap) : null;
    return s?.id ? s : null;
  } catch {
    return null;
  }
}
