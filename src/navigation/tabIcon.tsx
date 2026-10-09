import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

// Every name passed in must also have an "-outline" variant in Ionicons.
type IconName = keyof typeof Ionicons.glyphMap;

// Bottom tab icon: filled when the tab is selected, outlined otherwise.
export function tabIcon(name: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
    const shown = focused ? name : (`${name}-outline` as IconName);
    return <Ionicons name={shown} size={size} color={color} />;
  };
}
