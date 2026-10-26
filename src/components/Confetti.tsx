import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";

// A golden confetti gun for big moments (10% badge, gold stars, a won challenge).
// Two cannons in the bottom corners fire two volleys up and in, then the pieces
// flutter down. Plain React Native Animated on the native driver, so it needs
// no new build. Draws over everything and never takes a tap.

const GOLDS = [BRAND_GOLD, "#F5D76E", "#B8860B", "#FFE9A3", "#E6C35C", "#FFFFFF"];
const PER_VOLLEY = 26; // per cannon, per volley
const VOLLEYS = [0, 0.14];
const DURATION = 3400;

type Piece = {
  left: boolean;
  start: number; // 0-1 of the whole run, when this piece fires
  xs: number[];
  ys: number[];
  flips: number[];
  spin: number;
  color: string;
  w: number;
  h: number;
  round: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Keyframes along a piece's own life (0-1): a fast burst to its peak, then a slow swaying fall.
const BURST = [0, 0.05, 0.11, 0.18];
const FALL = [0.32, 0.46, 0.6, 0.74, 0.88, 1];
const LIFE = [...BURST, ...FALL];

function makePieces(width: number, height: number): Piece[] {
  const pieces: Piece[] = [];
  for (const start of VOLLEYS) {
    for (const left of [true, false]) {
      for (let i = 0; i < PER_VOLLEY; i++) {
        const x0 = left ? -10 : width + 10;
        const y0 = height + 10;
        const dir = left ? 1 : -1;
        const peakX = x0 + dir * rand(width * 0.15, width * 0.85);
        const peakY = rand(height * 0.05, height * 0.55);
        const xs: number[] = [];
        const ys: number[] = [];
        for (const k of [0, 0.33, 0.66, 1]) {
          const e = 1 - Math.pow(1 - k, 3);
          xs.push(x0 + (peakX - x0) * e);
          ys.push(y0 + (peakY - y0) * e);
        }
        const drift = dir * rand(10, 60);
        const sway = rand(14, 32);
        const fallTo = height + 40;
        FALL.forEach((_, j) => {
          const p = (j + 1) / FALL.length;
          xs.push(peakX + drift * p + Math.sin(p * Math.PI * 3 + i) * sway);
          ys.push(peakY + (fallTo - peakY) * p);
        });
        const round = Math.random() < 0.25;
        const w = round ? rand(6, 9) : rand(6, 10);
        pieces.push({
          left,
          start: start + rand(0, 0.04),
          xs,
          ys,
          flips: LIFE.map((_, j) => Math.cos(j * rand(1.2, 2.2))),
          spin: rand(1, 4) * (Math.random() < 0.5 ? -1 : 1),
          color: GOLDS[Math.floor(Math.random() * GOLDS.length)],
          w,
          h: round ? w : rand(10, 16),
          round,
        });
      }
    }
  }
  return pieces;
}

// `fire`: change it to a new number (or true) to fire again.
export default function Confetti({ fire }: { fire: number | boolean }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(() => (fire ? makePieces(width, height) : []), [fire, width, height]);

  useEffect(() => {
    if (!fire) return;
    t.setValue(0);
    const run = Animated.timing(t, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [fire, t]);

  if (!fire) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        // Map the piece's own life onto the whole run, from when it fires.
        const input = LIFE.map((u) => p.start + u * (1 - p.start));
        const range = (out: number[]) => t.interpolate({ inputRange: input, outputRange: out, extrapolate: "clamp" });
        const opacity = t.interpolate({
          inputRange: [p.start, p.start + 0.005, 0.86, 1],
          outputRange: [0, 1, 1, 0],
          extrapolate: "clamp",
        });
        const rotate = t.interpolate({
          inputRange: [p.start, 1],
          outputRange: ["0deg", `${p.spin * 360}deg`],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: p.w,
              height: p.h,
              borderRadius: p.round ? p.w / 2 : 1.5,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX: range(p.xs) }, { translateY: range(p.ys) }, { rotate }, { scaleY: range(p.flips) }],
            }}
          />
        );
      })}
    </View>
  );
}
