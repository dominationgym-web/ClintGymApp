import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";

export type IconName = keyof typeof Ionicons.glyphMap;

export interface ScreenTab<K extends string> {
  key: K;
  label: string;
  // Must also have an "-outline" variant in Ionicons.
  icon: IconName;
  // Colour of a small alert dot on the icon, if any.
  dot?: string | null;
}

// A bar of tabs for one screen, so the trainer can jump straight to one kind
// of info instead of scrolling past everything else. "top" is for screens that
// already sit above the app's own bottom tabs, so the two bars don't stack.
export default function ScreenTabBar<K extends string>({
  tabs,
  current,
  onChange,
  position = "bottom",
}: {
  tabs: ScreenTab<K>[];
  current: K;
  onChange: (key: K) => void;
  position?: "top" | "bottom";
}) {
  const insets = useSafeAreaInsets();
  const edge =
    position === "bottom"
      ? { borderTopWidth: 1, paddingBottom: Math.max(insets.bottom, 8) }
      : { borderBottomWidth: 1, paddingBottom: 8 };
  return (
    <View style={[styles.tabBar, edge]}>
      {tabs.map((t) => {
        const focused = t.key === current;
        return (
          <Pressable key={t.key} style={styles.tabButton} onPress={() => onChange(t.key)}>
            <View>
              <Ionicons
                name={focused ? t.icon : (`${t.icon}-outline` as IconName)}
                size={22}
                color={focused ? BRAND_GOLD : "#64748B"}
              />
              {t.dot && <View style={[styles.tabDot, { backgroundColor: t.dot }]} />}
            </View>
            <Text style={[styles.tabLabel, focused && { color: BRAND_GOLD }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderColor: "#1E293B",
    paddingTop: 8,
  },
  tabButton: { flex: 1, alignItems: "center", gap: 2 },
  tabLabel: { color: "#64748B", fontSize: 10, fontWeight: "600" },
  tabDot: { position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5 },
});
