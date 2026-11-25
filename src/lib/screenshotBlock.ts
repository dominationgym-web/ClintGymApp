import { useEffect } from "react";
import { Platform } from "react-native";

// Screenshots and screen recordings blocked inside the app (GRIZZ, 2026-11-25:
// "especially on the trainer side"), through expo-screen-capture.
// Android: the screen can't be captured at all (FLAG_SECURE), and the recent
// apps preview is blank. iPhone (iOS 13+): screenshots and recordings come out
// blank, and the app switcher preview is blurred.
//
// Phones on a build from before this don't have the native part, and requiring
// a missing native module crashes the app (see calendarImport.ts), so we check
// first. On those builds nothing is blocked until they install a new build.

type ScreenCapture = typeof import("expo-screen-capture");
let mod: ScreenCapture | null | undefined;

function screenCapture(): ScreenCapture | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === "web") return null;
  try {
    const modules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
    if (!modules || modules.ExpoScreenCapture == null) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-screen-capture") as ScreenCapture;
  } catch {
    mod = null;
  }
  return mod;
}

/** Who gets screenshots blocked. Signed-out screens (log in, sign up) stay open. */
export function shouldBlockScreenshots(role: string | null): boolean {
  return role === "trainer" || role === "client";
}

const KEY = "daily-evolution";

/** Blocks screenshots while `on` is true, and lets them again when it turns false. */
export function useBlockScreenshots(on: boolean): void {
  useEffect(() => {
    const sc = screenCapture();
    if (!sc || !on) return;
    sc.preventScreenCaptureAsync(KEY).catch(() => undefined);
    if (Platform.OS === "ios") sc.enableAppSwitcherProtectionAsync(0.9).catch(() => undefined);
    return () => {
      sc.allowScreenCaptureAsync(KEY).catch(() => undefined);
      if (Platform.OS === "ios") sc.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, [on]);
}
