import React from "react";
import { Pressable, type PressableStateCallbackType, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CommonActions } from "@react-navigation/native";
import { navigationRef } from "@/navigation/navigationRef";
import { useCurrentRoute } from "@/components/TrainerSidebar";
import { useClientMenuItems } from "@/components/SectionsMenuButton";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import type { ClientTabParamList } from "@/navigation/types";
import { themeText, themedStyles } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

// Back to the tabs underneath with nothing stacked on top, on the tab given.
function goToTab(name: keyof ClientTabParamList) {
  const root = navigationRef.getRootState();
  navigationRef.dispatch(
    CommonActions.navigate({ name: "ClientTabs", params: { screen: name }, pop: root ? root.index > 0 : false }),
  );
}

// A menu page replaces whatever page is open, so Back goes to the tab underneath.
function openPage(open: () => void) {
  const root = navigationRef.getRootState();
  if (root && root.index > 0) navigationRef.dispatch(CommonActions.navigate({ name: "ClientTabs", pop: true }));
  open();
}

// A row lights up under the mouse (react-native-web passes hovered).
const itemStyle = (on: boolean) => (state: PressableStateCallbackType) => [
  styles.item,
  (state as { hovered?: boolean }).hovered && styles.itemHover,
  on && styles.itemOn,
];

// Re-check the coach's meal plan and stability program as the client moves around.
const recheck = (check: () => void) => navigationRef.addListener("state", check);

// The client's laptop view (GRIZZ, 2026-10-27): their week, weights lifted,
// body and food first, then the phone tabs, then every ☰ menu page, all one
// click away. Replaces the bottom tabs and the ☰ menu on a wide window.
export default function ClientSidebar() {
  const { client } = useAuth();
  const menu = useClientMenuItems(recheck);
  const current = useCurrentRoute();
  const name = current?.name;
  const sectionKey = name === "Section" ? (current?.params?.sectionKey as string | undefined) : undefined;

  const main: { tab: keyof ClientTabParamList; label: string; icon: IconName }[] = client?.live_only
    ? [
        // Live client only (0169): sessions, food, an optional check-in and Profile.
        { tab: "Sessions", label: "My sessions", icon: "people" },
        { tab: "Food", label: "Nutrition & diet", icon: "restaurant" },
        { tab: "CheckIn", label: "Check-in", icon: "checkmark-circle" },
        ...(client.library_access ? [{ tab: "Exercises" as const, label: "My training", icon: "fitness" as IconName }] : []),
        { tab: "Profile", label: "Profile", icon: "person-circle" },
      ]
    : [
        { tab: "MyWeek", label: "My week", icon: "home" },
        { tab: "Lifts", label: "Weights lifted", icon: "barbell" },
        { tab: "Body", label: "Body & weight", icon: "body" },
        { tab: "Food", label: "Nutrition & diet", icon: "restaurant" },
        { tab: "CheckIn", label: "Check-in", icon: "checkmark-circle" },
        { tab: "Exercises", label: "My training", icon: "fitness" },
        { tab: "Habits", label: "Habits & challenges", icon: "flame" },
        ...(client?.lifestyle_reset_started_at ? [{ tab: "Reset" as const, label: "My reset", icon: "leaf" as IconName }] : []),
        { tab: "Profile", label: "Profile", icon: "person-circle" },
      ];

  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.brand}>Daily Evolution</Text>
        {client ? (
          <Text style={styles.who} numberOfLines={1}>
            {client.name}
          </Text>
        ) : null}

        {main.map((m) => {
          const on = name === m.tab;
          return (
            <Pressable key={m.tab} onPress={() => goToTab(m.tab)} style={itemStyle(on)} accessibilityRole="button" accessibilityLabel={m.label}>
              <Ionicons name={on ? m.icon : (`${m.icon}-outline` as IconName)} size={19} color={themeText(on ? BRAND_GOLD : "#94A3B8")} />
              <Text style={[styles.itemText, on && styles.itemTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => openPage(() => navigationRef.navigate("Search"))}
          style={itemStyle(name === "Search")}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={19} color={themeText(name === "Search" ? BRAND_GOLD : "#94A3B8")} />
          <Text style={[styles.itemText, name === "Search" && styles.itemTextOn]}>Search</Text>
        </Pressable>

        <Text style={styles.heading}>More</Text>
        {menu.map((m) => {
          const on = m.route === "Section" ? sectionKey === m.key : !!m.route && m.route === name;
          return (
            <Pressable
              key={m.key}
              onPress={() => openPage(m.onPress)}
              style={itemStyle(on)}
              accessibilityRole="button"
              accessibilityLabel={m.title}
              accessibilityHint={m.summary}
            >
              {/* ️ asks for the colour emoji, so ⏱ comes out in colour. */}
              <Text style={styles.emoji}>{m.icon?.replace(/️/g, "")}{"️"}</Text>
              <Text style={[styles.itemText, on && styles.itemTextOn]} numberOfLines={1}>
                {m.title.replace(/\s*\(.*\)$/, "")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles({
  sidebar: { width: 260, backgroundColor: "#0B1222", borderRightWidth: 1, borderRightColor: "#1E293B" },
  inner: { paddingVertical: 18, paddingHorizontal: 12, gap: 2 },
  brand: { color: BRAND_GOLD, fontSize: 20, fontWeight: "800", paddingHorizontal: 10 },
  who: { color: "#94A3B8", fontSize: 12, paddingHorizontal: 10, marginTop: 2, marginBottom: 16 },
  heading: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    marginTop: 18,
    marginBottom: 4,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8 },
  itemHover: { backgroundColor: "#131D33" },
  itemOn: { backgroundColor: "#1E293B" },
  itemText: { color: "#CBD5E1", fontSize: 14, flexShrink: 1 },
  itemTextOn: { color: BRAND_GOLD, fontWeight: "700" },
  emoji: { width: 19, textAlign: "center", fontSize: 15 },
});
