// What the mini speedometer window shows. The running heart rate session
// publishes here and the mini window (drawn over the whole app) reads it.
import { useSyncExternalStore } from "react";
import type { HrZone } from "@/lib/heartRateZones";

export type HrMiniState = {
  zones: HrZone[];
  target: HrZone;
  hr: number | null;
  lost: boolean;
};

let state: HrMiniState | null = null;
const listeners = new Set<() => void>();

export function setHrMini(next: HrMiniState | null): void {
  state = next;
  listeners.forEach((l) => l());
}

/** True while a heart rate session is running (used so the app lock doesn't end it). */
export function hrSessionRunning(): boolean {
  return state != null;
}

export function useHrMini(): HrMiniState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
