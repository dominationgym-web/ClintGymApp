import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_LOCK_DELAY_MINUTES, newSalt, pinHash } from "@/lib/appLockRules";

// App lock (GRIZZ, 2026-11-10). Saved on this phone or laptop only, and wiped
// on Log out, so a forgotten PIN is fixed by logging out and signing in with
// the password. The PIN is kept as a salted hash.

export type AppLockSettings = {
  enabled: boolean;
  salt: string;
  hash: string;
  biometrics: boolean;
  delayMinutes: number;
};

const STORAGE_KEY = "app-lock";
const SUGGESTED_KEY = "app-lock-suggested";

const OFF: AppLockSettings = { enabled: false, salt: "", hash: "", biometrics: false, delayMinutes: DEFAULT_LOCK_DELAY_MINUTES };

let settings: AppLockSettings = OFF;
let ready = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function parse(raw: string | null): AppLockSettings {
  if (!raw) return OFF;
  try {
    const v = JSON.parse(raw) as Partial<AppLockSettings>;
    if (!v.enabled || !v.salt || !v.hash) return OFF;
    return {
      enabled: true,
      salt: String(v.salt),
      hash: String(v.hash),
      biometrics: !!v.biometrics,
      delayMinutes: typeof v.delayMinutes === "number" ? v.delayMinutes : DEFAULT_LOCK_DELAY_MINUTES,
    };
  } catch {
    return OFF;
  }
}

// The website reads it straight away, so the laptop never flashes a page before the lock.
if (Platform.OS === "web" && typeof localStorage !== "undefined") {
  try {
    settings = parse(localStorage.getItem(STORAGE_KEY));
    ready = true;
  } catch {
    // Private windows can refuse storage: no lock.
  }
}

export async function loadAppLock() {
  if (ready) return;
  try {
    settings = parse(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    settings = OFF;
  }
  ready = true;
  notify();
}

async function save(next: AppLockSettings) {
  settings = next;
  notify();
  try {
    if (next.enabled) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Holds until the app closes.
  }
}

export function turnOnAppLock(pin: string, biometrics: boolean, delayMinutes = settings.delayMinutes) {
  const salt = newSalt();
  return save({ enabled: true, salt, hash: pinHash(pin, salt), biometrics, delayMinutes });
}

export function changeAppLockPin(pin: string) {
  const salt = newSalt();
  return save({ ...settings, salt, hash: pinHash(pin, salt) });
}

export function setAppLockBiometrics(on: boolean) {
  return save({ ...settings, biometrics: on });
}

export function setAppLockDelay(minutes: number) {
  return save({ ...settings, delayMinutes: minutes });
}

export function turnOffAppLock() {
  return save(OFF);
}

export function checkAppLockPin(pin: string): boolean {
  return settings.enabled && pinHash(pin, settings.salt) === settings.hash;
}

export function getAppLock(): AppLockSettings {
  return settings;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppLock(): AppLockSettings {
  return useSyncExternalStore(subscribe, getAppLock, getAppLock);
}

export function useAppLockReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}

// Trainers get asked once on each phone (money and client details live there).
export async function appLockSuggested(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SUGGESTED_KEY)) != null;
  } catch {
    return true;
  }
}

export async function markAppLockSuggested() {
  try {
    await AsyncStorage.setItem(SUGGESTED_KEY, "1");
  } catch {
    // Asked again next time; no harm.
  }
}

/** Called on Log out: the next person signs in with a password and sets their own. */
export async function clearAppLockOnSignOut() {
  await save(OFF);
  try {
    await AsyncStorage.removeItem(SUGGESTED_KEY);
  } catch {
    // Fine.
  }
}
