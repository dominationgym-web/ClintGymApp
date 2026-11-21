import React from "react";
import { Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";

// Keeps the phone's screen on during a workout, a live session and the timers
// (GRIZZ, 2026-11-21), so the rest timer stays visible and its beep still plays:
// a phone that turns its screen off pauses the app, timers and sounds included.
// Only while the screen is the one showing; the phone sleeps normally after.
function Awake() {
  useKeepAwake("workout");
  return null;
}

// Phones only: on the website the browser's wake lock throws "has not activated
// yet" when you leave the screen quickly, and a laptop doesn't need it.
export default function KeepScreenOn({ when = true }: { when?: boolean }) {
  if (Platform.OS === "web") return null;
  return <KeepScreenOnPhone when={when} />;
}

function KeepScreenOnPhone({ when }: { when: boolean }) {
  let focused = true;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    focused = useIsFocused();
  } catch {
    // Outside a navigator (e.g. inside a modal's own tree): keep it on.
  }
  return when && focused ? <Awake /> : null;
}
