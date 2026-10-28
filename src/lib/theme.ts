import { useSyncExternalStore } from "react";
import { Appearance, Platform, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Light and dark mode (GRIZZ, 2026-10-28). The app is drawn in dark navy; light
// mode is worked out from those same colours, so screens keep one set of styles:
//
// - Styles made with themedStyles() (instead of StyleSheet.create) carry a light
//   copy and hand out whichever one matches the mode.
// - Colours chosen while drawing go through themeText / themeBg / themeBorder.
//
// Dark navy stays the default. Changing the mode remounts the screens (App.tsx),
// which keeps the page you are on.

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";

const STORAGE_KEY = "theme-preference";

let preference: ThemePreference = "dark";
let mode: ThemeMode = "dark";
let ready = false;
const listeners = new Set<() => void>();

function systemMode(): ThemeMode {
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
}

function apply(next: ThemePreference) {
  preference = next;
  mode = next === "system" ? systemMode() : next;
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.style.colorScheme = mode;
    document.body?.style.setProperty("background-color", mode === "light" ? "#CBD5E1" : "#020617");
  }
  listeners.forEach((l) => l());
}

function isPreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

// The website can read the saved choice straight away, so it never flashes dark.
if (Platform.OS === "web" && typeof localStorage !== "undefined") {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isPreference(saved)) apply(saved);
    ready = true;
  } catch {
    // Private windows can refuse storage; dark it is.
  }
}

// "Match phone" follows the phone's setting each time the app opens, not while
// it is open: switching mid-workout would remount the screen and lose what was typed.
export async function loadThemePreference() {
  if (ready) return;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (isPreference(saved)) apply(saved);
  } catch {
    // Keep dark.
  }
  ready = true;
  listeners.forEach((l) => l());
}

export async function setThemePreference(next: ThemePreference) {
  apply(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still holds until the app closes.
  }
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function getThemePreference(): ThemePreference {
  return preference;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeMode, getThemeMode);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
}

export function useThemeReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}

// ---- Colour mapping -------------------------------------------------------

// The navy greys the dark screens are built from, and their light-mode partners.
// Every light value maps to itself, so a colour mapped twice stays put.
const BG: Record<string, string> = {
  "#020617": "#CBD5E1",
  "#0F172A": "#EEF2F7",
  "#1E293B": "#FFFFFF",
  "#111C33": "#F8FAFC",
  "#111827": "#F8FAFC",
  "#273449": "#E2E8F0",
  "#334155": "#E2E8F0",
  "#475569": "#CBD5E1",
};

const TEXT: Record<string, string> = {
  "#FFFFFF": "#0F172A",
  "#F8FAFC": "#0F172A",
  "#F1F5F9": "#0F172A",
  "#E2E8F0": "#1E293B",
  "#CBD5E1": "#344256",
  "#94A3B8": "#475569",
  "#64748B": "#64748B",
  "#475569": "#475569",
  "#334155": "#8696AC",
  "#8696AC": "#8696AC",
};

const BORDER: Record<string, string> = {
  "#0F172A": "#E2E8F0",
  "#1E293B": "#E2E8F0",
  "#334155": "#CBD5E1",
  "#475569": "#94A3B8",
  "#64748B": "#94A3B8",
  "#94A3B8": "#94A3B8",
};

const NAMED: Record<string, string> = { white: "#FFFFFF", black: "#000000" };

function normalise(colour: string): string | null {
  const c = NAMED[colour.toLowerCase()] ?? colour.toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(c)) return "#" + [...c.slice(1)].map((d) => d + d).join("");
  return /^#[0-9A-F]{6}$/.test(c) ? c : null;
}

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Bright accent text (green, amber, red, gold) is too pale on white, so it is
// darkened; dark text that sat on a bright button stays as it is.
export function lightText(colour: string): string {
  const c = normalise(colour);
  if (!c) return colour;
  if (TEXT[c]) return TEXT[c];
  const hsl = toHsl(c);
  return hsl.l > 0.45 ? fromHsl({ ...hsl, l: 0.27 }) : colour;
}

// Dark panels become light ones: navy greys from the table, tinted panels
// (the dark green, amber and red boxes) become pale tints of the same colour.
// Bright fills like the green and gold buttons stay as they are.
export function lightBg(colour: string): string {
  const c = normalise(colour);
  if (!c) return colour;
  if (BG[c]) return BG[c];
  const hsl = toHsl(c);
  if (c === "#000000" || hsl.l >= 0.35) return colour;
  return fromHsl({ h: hsl.h, s: Math.min(hsl.s, 0.7), l: 0.93 });
}

export function lightBorder(colour: string): string {
  const c = normalise(colour);
  if (!c) return colour;
  if (BORDER[c]) return BORDER[c];
  const hsl = toHsl(c);
  if (hsl.l >= 0.35) return colour;
  return fromHsl({ h: hsl.h, s: Math.min(hsl.s, 0.7), l: 0.75 });
}

// Colours picked while drawing (inline styles, icon colours).
export function themeText<C>(colour: C): C {
  return mode === "light" && typeof colour === "string" ? (lightText(colour) as C) : colour;
}

export function themeBg<C>(colour: C): C {
  return mode === "light" && typeof colour === "string" ? (lightBg(colour) as C) : colour;
}

export function themeBorder<C>(colour: C): C {
  return mode === "light" && typeof colour === "string" ? (lightBorder(colour) as C) : colour;
}

function lightFor(prop: string): ((c: string) => string) | null {
  if (prop === "backgroundColor") return lightBg;
  if (/^border\w*Color$/.test(prop)) return lightBorder;
  if (prop === "color" || prop === "tintColor" || prop === "textDecorationColor") return lightText;
  return null;
}

export function lightStyle<S extends object>(style: S): S {
  const out: Record<string, unknown> = {};
  for (const [prop, value] of Object.entries(style)) {
    const map = lightFor(prop);
    out[prop] = map && typeof value === "string" ? map(value) : value;
  }
  return out as S;
}

// Use instead of StyleSheet.create. `keep` names styles that sit on a photo,
// video or black overlay and must look the same in both modes.
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  styles: T & StyleSheet.NamedStyles<any>,
  keep: (keyof T)[] = []
): T {
  const dark = StyleSheet.create(styles);
  const lightSource: Record<string, unknown> = {};
  for (const [key, style] of Object.entries(styles)) {
    lightSource[key] = keep.includes(key as keyof T) ? { ...(style as object) } : lightStyle(style as object);
  }
  const light = StyleSheet.create(lightSource as T & StyleSheet.NamedStyles<any>);
  const out = {} as T;
  for (const key of Object.keys(styles)) {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => (mode === "light" ? light : dark)[key as keyof T],
    });
  }
  return out;
}
