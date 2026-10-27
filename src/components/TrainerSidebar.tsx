import React, { useEffect, useState } from "react";
import { Pressable, type PressableStateCallbackType, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CommonActions } from "@react-navigation/native";
import { navigationRef } from "@/navigation/navigationRef";
import { useTrainerMenuItems } from "@/components/TrainerMenuButton";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { trainerDisplayName } from "@/lib/trainers";
import type { TrainerTabParamList } from "@/navigation/types";

type IconName = keyof typeof Ionicons.glyphMap;
type CurrentRoute = { name: string; params?: Record<string, unknown> } | undefined;

// The page on screen right now, kept up to date as the trainer moves around.
export function useCurrentRoute(): CurrentRoute {
  const [route, setRoute] = useState<CurrentRoute>(() =>
    navigationRef.isReady() ? (navigationRef.getCurrentRoute() as CurrentRoute) : undefined,
  );
  useEffect(() => {
    const update = () => setRoute(navigationRef.getCurrentRoute() as CurrentRoute);
    if (navigationRef.isReady()) update();
    return navigationRef.addListener("state", update);
  }, []);
  return route;
}

// Back to the tabs underneath, with nothing stacked on top, then `then`. One
// action, so a client page with unsaved changes can still ask first
// (ClientDetail's beforeRemove, which may wait on the database); `then` only
// runs once the page has really closed, and not at all if the trainer stays.
let pendingOpen: (() => void) | null = null;
function closeStackedPages(then: () => void) {
  pendingOpen?.();
  const root = navigationRef.getRootState();
  if (!root || root.index === 0) return then();
  const top = root.routes[root.index].key;
  const stop = () => {
    off();
    clearTimeout(timer);
    pendingOpen = null;
  };
  const off = navigationRef.addListener("state", () => {
    const now = navigationRef.getRootState();
    if (now?.index === 0) {
      stop();
      then();
    } else if (now && now.routes[now.index].key !== top) stop();
  });
  // Given up on if the trainer chose to stay and never left.
  const timer = setTimeout(stop, 60_000);
  pendingOpen = stop;
  navigationRef.dispatch(CommonActions.navigate({ name: "TrainerTabs", pop: true }));
}

function goToTab(name: keyof TrainerTabParamList) {
  const root = navigationRef.getRootState();
  navigationRef.dispatch(
    CommonActions.navigate({ name: "TrainerTabs", params: { screen: name }, pop: root ? root.index > 0 : false }),
  );
}

// A row lights up under the mouse (react-native-web passes hovered).
const itemStyle = (on: boolean) => (state: PressableStateCallbackType) => [
  styles.item,
  (state as { hovered?: boolean }).hovered && styles.itemHover,
  on && styles.itemOn,
];

const MAIN: { tab: keyof TrainerTabParamList; label: string; icon: IconName; also?: string[]; ownerOnly?: boolean }[] = [
  { tab: "Dashboard", label: "Dashboard", icon: "speedometer" },
  { tab: "Clients", label: "Clients", icon: "people", also: ["ClientDetail", "LiveWorkout", "GroupLive"] },
  { tab: "Programs", label: "Programs", icon: "barbell", also: ["ProgramBuilder"] },
  { tab: "Trainers", label: "Trainers", icon: "ribbon", ownerOnly: true },
  { tab: "TrainerProfile", label: "Profile & settings", icon: "person-circle", also: ["Billing"] },
];

// The trainer's laptop layout (GRIZZ, 2026-10-27): every section and every
// menu page down the left, one click each, always on screen. Replaces the
// bottom tabs and the ☰ menu on a wide window; phones keep those.
export default function TrainerSidebar() {
  const { trainer } = useAuth();
  const menu = useTrainerMenuItems();
  const current = useCurrentRoute();
  const name = current?.name;
  // My workout is the trainer's own live session.
  const myWorkout = name === "LiveWorkout" && current?.params?.self === true;
  const menuKey = myWorkout
    ? "myWorkout"
    : menu.find((m) => m.route === name || (name === "TrainerGuide" && m.route === "CoachingGuides"))?.key;

  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.brand}>Daily Evolution</Text>
        {trainer ? (
          <Text style={styles.who} numberOfLines={1}>
            {trainerDisplayName(trainer)}
          </Text>
        ) : null}

        {MAIN.filter((m) => !m.ownerOnly || trainer?.is_owner).map((m) => {
          const on = !menuKey && (name === m.tab || (!!name && !!m.also?.includes(name)));
          return (
            <Pressable
              key={m.tab}
              onPress={() => {
                pendingOpen?.();
                goToTab(m.tab);
              }}
              style={itemStyle(on)}
              accessibilityRole="button"
              accessibilityLabel={m.label}
            >
              <Ionicons name={on ? m.icon : (`${m.icon}-outline` as IconName)} size={19} color={on ? BRAND_GOLD : "#94A3B8"} />
              <Text style={[styles.itemText, on && styles.itemTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => closeStackedPages(() => navigationRef.navigate("Search"))}
          style={itemStyle(name === "Search")}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={19} color={name === "Search" ? BRAND_GOLD : "#94A3B8"} />
          <Text style={[styles.itemText, name === "Search" && styles.itemTextOn]}>Search</Text>
        </Pressable>

        <Text style={styles.heading}>Tools & help</Text>
        {menu.map((m) => {
          const on = m.key === menuKey;
          return (
            <Pressable
              key={m.key}
              onPress={() => closeStackedPages(m.onPress)}
              style={itemStyle(on)}
              accessibilityRole="button"
              accessibilityLabel={m.title}
              accessibilityHint={m.summary}
            >
              {/* \uFE0F asks for the colour emoji, so ⏱ and 🛠 don't come out as dark text. */}
              <Text style={styles.emoji}>{m.icon?.replace(/\uFE0F/g, "")}{"\uFE0F"}</Text>
              <Text style={[styles.itemText, on && styles.itemTextOn]} numberOfLines={1}>
                {m.title.replace(/\s*\(.*\)$/, "").replace(/ programming$/, "")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 270, backgroundColor: "#0B1222", borderRightWidth: 1, borderRightColor: "#1E293B" },
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
