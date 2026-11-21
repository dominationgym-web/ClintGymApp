import React, { useEffect, useRef } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { themeBg } from "@/lib/theme";
import { reduceMotion } from "@/lib/motion";

// A grey shape the size of what's loading (GRIZZ, 2026-11-21 design review):
// used instead of a spinning circle, so the page doesn't jump when it arrives.
// Breathes gently; still for anyone whose phone asks for less motion.
export default function Skeleton({
  height = 16,
  width = "100%",
  radius = 12,
  style,
}: {
  height?: DimensionValue;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: themeBg("#1E293B"), opacity: pulse }, style]} />;
}
