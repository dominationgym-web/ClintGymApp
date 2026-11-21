import React from "react";
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

export default function KeepScreenOn({ when = true }: { when?: boolean }) {
  let focused = true;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    focused = useIsFocused();
  } catch {
    // Outside a navigator (e.g. inside a modal's own tree): keep it on.
  }
  return when && focused ? <Awake /> : null;
}
