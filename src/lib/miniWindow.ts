// Mini speedometer window (GRIZZ, 2026-11-25): on Android the app can shrink
// into a small floating window (picture-in-picture) so a client walking on the
// treadmill can watch a movie and still see their heart rate zone. iPhone
// only allows that for videos, so this is Android only for now.
//
// The native part only exists in app builds made after it was added. Older
// builds that get this as an instant update simply don't show the button.
import { useEffect, useState } from "react";
import { AppState, Dimensions, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

type PipModule = {
  enterPipMode: (o: object) => void;
  setPictureInPictureParams: (o: object) => void;
  isInPipMode: () => boolean;
  addListener: (event: string, cb: (e: { isInPipMode: boolean }) => void) => { remove: () => void };
};

let pip: PipModule | null | undefined;
function load(): PipModule | null {
  if (pip !== undefined) return pip;
  // Screenshot harnesses hand in a pretend window here.
  const pretend = (globalThis as { __pretendMiniWindow?: PipModule }).__pretendMiniWindow;
  if (pretend) return (pip = pretend);
  pip = null;
  if (Platform.OS !== "android") return null;
  try {
    pip = requireOptionalNativeModule<PipModule>("ExpoPip");
  } catch {
    pip = null;
  }
  return pip;
}

// Landscape-ish, like a small TV in the corner: room for the dial and the bpm.
const SHAPE = { width: 4, height: 3 };

/** True on an Android build that has the mini window. */
export function miniWindowSupported(): boolean {
  return load() != null;
}

/** Shrinks the app into the floating window now. */
export function enterMiniWindow(): void {
  try {
    load()?.enterPipMode({ ...SHAPE });
  } catch {
    // Some phones (or a setting) turn picture-in-picture off: nothing happens.
  }
}

/**
 * While a session is running, pressing Home (or opening another app) shrinks
 * the speedometer by itself (Android 12 and newer). Off again when it ends.
 */
export function setAutoMiniWindow(on: boolean): void {
  try {
    load()?.setPictureInPictureParams({ ...SHAPE, autoEnterEnabled: on });
  } catch {
    // ignore
  }
}

/**
 * True while the app is the small floating window. The library's own event
 * doesn't always arrive (on GRIZZ's Samsung the window showed the full-size
 * screen), so it also checks whenever the app goes to the background or the
 * window changes size.
 */
export function useInMiniWindow(): boolean {
  const [inMini, setInMini] = useState(false);
  useEffect(() => {
    const m = load();
    if (!m) return;
    const check = () => setInMini(inMiniWindowNow());
    const subs = [
      m.addListener("onPipModeChange", (e) => setInMini(!!e?.isInPipMode)),
      AppState.addEventListener("change", check),
      Dimensions.addEventListener("change", check),
    ];
    check();
    return () => subs.forEach((s) => s.remove());
  }, []);
  return inMini;
}

/** Whether the app is in the floating window right now. */
export function inMiniWindowNow(): boolean {
  try {
    return load()?.isInPipMode() === true;
  } catch {
    return false;
  }
}
