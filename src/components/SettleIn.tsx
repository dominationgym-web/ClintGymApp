import React, { useEffect, useRef, useState } from "react";
import { Animated, View, type LayoutChangeEvent } from "react-native";
import { DURATION, EASE_OUT, reduceMotion } from "@/lib/motion";
import Skeleton from "@/components/Skeleton";

// Stops a screen jumping while its cards load one by one (GRIZZ, 2026-11-21:
// the client Today tab moved "All good" under the finger for 2 seconds).
// The real content is laid out out of sight under grey placeholders; once its
// height has stopped changing for a moment (or after 1.5 s at most) it fades in,
// already in its final place. Only the first time per app open for each `id`,
// so saving or coming back to the screen never hides it again.

const settled = new Set<string>();
const QUIET_MS = 300;
const MAX_MS = 1500;

export default function SettleIn({ id, children, placeholder }: { id: string; children: React.ReactNode; placeholder?: React.ReactNode }) {
  const [shown, setShown] = useState(settled.has(id));
  const fade = useRef(new Animated.Value(shown ? 1 : 0)).current;
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const height = useRef(0);

  const reveal = () => {
    settled.add(id);
    setShown(true);
    if (reduceMotion()) fade.setValue(1);
    else Animated.timing(fade, { toValue: 1, duration: DURATION.normal, easing: EASE_OUT, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (shown) return;
    const cap = setTimeout(reveal, MAX_MS);
    quiet.current = setTimeout(reveal, QUIET_MS * 2);
    return () => {
      clearTimeout(cap);
      if (quiet.current) clearTimeout(quiet.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    if (shown) return;
    const h = Math.round(e.nativeEvent.layout.height);
    if (h === height.current) return;
    height.current = h;
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(reveal, QUIET_MS);
  };

  return (
    <View>
      <Animated.View onLayout={onLayout} style={{ opacity: fade }} pointerEvents={shown ? "auto" : "none"}>
        {children}
      </Animated.View>
      {!shown && (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0 }} pointerEvents="none">
          {placeholder ?? <SkeletonCards />}
        </View>
      )}
    </View>
  );
}

/** Grey shapes in the same places as the client Today tab: coach line, the
 *  workout card with its Start button, the "things for today" row, the
 *  check-in title and two answer buttons. So nothing seems to move when the
 *  real page fades in. */
export function SkeletonCards() {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Skeleton height={40} width={40} radius={20} />
        <Skeleton height={18} width="55%" />
      </View>
      <Skeleton height={90} />
      <Skeleton height={44} />
      <Skeleton height={28} width="35%" style={{ alignSelf: "center", marginTop: 4 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Skeleton height={56} style={{ flex: 1 }} />
        <Skeleton height={56} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
