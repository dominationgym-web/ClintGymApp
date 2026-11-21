import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Pressable as RNPressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  StyleSheet,
  type View,
  type ViewStyle,
} from "react-native";
import { EASE_OUT, reduceMotion } from "@/lib/motion";

// Every button and tappable row in the app (GRIZZ, 2026-11-21 design review):
// it shrinks a touch the moment a finger lands and springs back on release, so
// a tap always gets an answer. Big rows shrink by only a few points (never more
// than 3%), small buttons by 3%. Drop-in for react-native's Pressable: same
// props, and a style can still be a function of { pressed }.

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

type Props = PressableProps & { ref?: React.Ref<View> };

export default function Pressable({ style, onPressIn, onPressOut, onLayout, disabled, ref, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const [down, setDown] = useState(0.97);

  const to = useCallback(
    (value: number, ms: number) => {
      if (reduceMotion()) return;
      Animated.timing(scale, { toValue: value, duration: ms, easing: EASE_OUT, useNativeDriver: true }).start();
    },
    [scale],
  );

  const handleIn = (e: GestureResponderEvent) => {
    if (typeof style === "function") setPressed(true);
    if (down < 1) to(down, 90);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    if (typeof style === "function") setPressed(false);
    to(1, 160);
    onPressOut?.(e);
  };
  const handleLayout = (e: LayoutChangeEvent) => {
    // A full-width row shrinking 3% looks like it jumps; cap it at about 8 points.
    // Big areas (a pop-up's dark backdrop, a whole card) don't shrink at all.
    const { width: w, height: h } = e.nativeEvent.layout;
    if (h > 220) setDown(1);
    else if (w > 0) setDown(Math.max(0.97, 1 - 8 / w));
    onLayout?.(e);
  };

  const own: StyleProp<ViewStyle> =
    typeof style === "function" ? style({ pressed } as PressableStateCallbackType) : (style as StyleProp<ViewStyle>);

  return (
    <AnimatedPressable
      ref={ref as never}
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onLayout={handleLayout}
      style={[own, disabled ? null : { transform: [...((StyleSheet.flatten(own)?.transform as object[]) ?? []), { scale }] }] as never}
    />
  );
}
