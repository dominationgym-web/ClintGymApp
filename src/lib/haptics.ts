// A light buzz on the moments that matter (GRIZZ, 2026-11-21 design review):
// logging a set, "All good", finishing a check-in, PIN keys, ticking a session.
// Needs a store build with expo-haptics; older builds just stay quiet, and the
// website never buzzes.
import { Platform } from "react-native";

type Haptics = typeof import("expo-haptics");
let mod: Haptics | null | undefined;

function load(): Haptics | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === "web") return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("expo-haptics") as Haptics;
    mod = m;
  } catch {
    mod = null;
  }
  return mod;
}

/** A tiny tick: a PIN key, a choice chip. */
export function tick() {
  try {
    load()?.selectionAsync().catch(() => {});
  } catch {}
}

/** A firm tap: Log set, All good, Start. */
export function tap() {
  try {
    const h = load();
    h?.impactAsync(h.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {}
}

/** A happy double buzz: check-in done, workout finished, session ticked trained. */
export function success() {
  try {
    const h = load();
    h?.notificationAsync(h.NotificationFeedbackType.Success).catch(() => {});
  } catch {}
}
