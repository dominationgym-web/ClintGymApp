import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";
import { themeBg, themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

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
  // The phone's Back button goes back through the tabs the trainer or client
  // looked at on this page, one at a time, before leaving the page.
  const history = useRef<K[]>([]);
  const last = useRef(current);
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    if (current === last.current) return;
    const h = history.current;
    // Coming back to the tab before this one is a step back; anything else is a step forward.
    if (h[h.length - 1] === current) history.current = h.slice(0, -1);
    else history.current = [...h.filter((k) => k !== last.current && k !== current), last.current];
    last.current = current;
    setDepth(history.current.length);
  }, [current]);
  useStepBack(depth > 0, () => {
    const prev = history.current[history.current.length - 1];
    if (prev !== undefined) onChange(prev);
  });
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
                color={themeText(focused ? BRAND_GOLD : "#64748B")}
              />
              {t.dot && <View style={[styles.tabDot, { backgroundColor: themeBg(t.dot) }]} />}
            </View>
            <Text style={[styles.tabLabel, focused && { color: themeText(BRAND_GOLD) }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
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
