import { AccessibilityInfo } from "react-native";

// Shared movement rules (GRIZZ, 2026-11-21 design review): quick (0.15-0.3 s),
// eases out so things arrive fast and settle, things appear from 95% size and
// never spin, and nothing moves for anyone whose phone asks for less motion.

export const DURATION = { press: 90, fast: 160, normal: 220, slow: 300 } as const;
/** Ease-out cubic: fast start, gentle stop. */
export const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

let reduced = false;
AccessibilityInfo?.isReduceMotionEnabled?.()
  .then((v) => {
    reduced = !!v;
  })
  .catch(() => {});
AccessibilityInfo?.addEventListener?.("reduceMotionChanged", (v: boolean) => {
  reduced = !!v;
});

/** True when the phone is set to reduce motion: skip the movement, keep the result. */
export function reduceMotion(): boolean {
  return reduced;
}
