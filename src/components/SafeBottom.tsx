import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Room at the bottom of a pop-up sheet for the phone's own buttons
// (GRIZZ, 2026-11-03: "Close button is too low", it sat under the Android
// Back/Home bar). Put it last inside the sheet. Nothing on the website.
export default function SafeBottom() {
  const insets = useSafeAreaInsets();
  if (!insets.bottom) return null;
  return <View style={{ height: insets.bottom }} />;
}
