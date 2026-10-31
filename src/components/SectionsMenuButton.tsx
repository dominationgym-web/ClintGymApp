import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { sectionsFor } from "@/lib/sections";
import { useAuth } from "@/context/AuthContext";
import MenuButton, { type MenuItem } from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { STABILITY_MENU_ITEM } from "@/lib/stability";
import { RECOVERY_MENU_ITEM } from "@/lib/recoveryActivities";
import { supabase } from "@/lib/supabase";
import { TIMER_MENU_ITEM } from "@/lib/timerWorkouts";
import { VIDEO_CHECKIN_MENU_ITEM } from "@/lib/videoCheckins";
import { CLIENT_SESSIONS_MENU_ITEM } from "@/lib/liveSessions";
import { HELP_SETTINGS_MENU_ITEM } from "@/screens/client/HelpSettingsScreen";
import { COACH_MEAL_PLAN_TITLE, useHasMealPlanWith, type Recheck } from "@/hooks/useHasMealPlan";
import { navigationRef } from "@/navigation/navigationRef";

// The client app's menu: Recovery (GRIZZ, 2026-10-17), Nutrition, Cycle tracker (the cycle guide
// and tracker, women only) and Sleep (GRIZZ, 2026-10-12) first, then the
// client's stability program (only once their coach has given them one: the
// trainer runs Stability, 2026-10-14), then
// the suggestion box (the coach wants it easy to find), the other sections
// and Help & settings.
const TOP_SECTIONS = ["nutrition", "womensHealthReset", "sleepRecovery"];

/**
 * The menu's pages, shared by the ☰ menu and the client's laptop sidebar.
 * `recheck` says when to look again for a stability program or meal plan the
 * coach may just have given.
 */
export function useClientMenuItems(recheck: Recheck): MenuItem[] {
  const { client } = useAuth();
  const sections = sectionsFor(client?.sex);
  const [hasStability, setHasStability] = useState(false);
  const hasMealPlan = useHasMealPlanWith(client?.id, recheck);
  useEffect(() => {
    if (!client) return;
    const check = () =>
      supabase
        .from("client_stability_programs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .is("ended_at", null)
        .then(({ count }) => setHasStability((count ?? 0) > 0));
    check();
    return recheck(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);
  // In-person sessions (0168): only once the coach has set them up.
  const [hasSessions, setHasSessions] = useState(false);
  useEffect(() => {
    if (!client) return;
    const check = () =>
      supabase
        .from("session_plans")
        .select("client_id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .then(({ count }) => setHasSessions((count ?? 0) > 0));
    check();
    return recheck(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);
  const first = TOP_SECTIONS.flatMap((key) => sections.filter((s) => s.key === key));
  const rest = sections.filter((s) => !TOP_SECTIONS.includes(s.key));
  const item = (section: (typeof sections)[number]): MenuItem => ({
    key: section.key,
    title: section.title,
    icon: section.icon,
    summary: section.summary,
    route: "Section",
    onPress: () => navigationRef.navigate("Section", { sectionKey: section.key }),
  });
  return [
    // Straight to the coach's meal plan, used every day (GRIZZ, 2026-10-27).
    ...(hasMealPlan
      ? [
          {
            key: "mealPlan",
            title: "My meal plan",
            icon: "🥗",
            summary: "The meal plan your coach made for you.",
            onPress: () => navigationRef.navigate("Section", { sectionKey: "nutrition", open: COACH_MEAL_PLAN_TITLE }),
          },
        ]
      : []),
    // In-person sessions with the coach (0168), once the coach has set them up.
    ...(hasSessions
      ? [{ ...CLIENT_SESSIONS_MENU_ITEM, route: "MySessions", onPress: () => navigationRef.navigate("MySessions") }]
      : []),
    { ...VIDEO_CHECKIN_MENU_ITEM, route: "VideoCheckIn", onPress: () => navigationRef.navigate("VideoCheckIn") },
    { ...RECOVERY_MENU_ITEM, route: "Recovery", onPress: () => navigationRef.navigate("Recovery") },
    ...first.map(item),
    // EMOM, Tabata and interval timers (GRIZZ, 2026-10-25).
    { ...TIMER_MENU_ITEM, route: "Timers", onPress: () => navigationRef.navigate("Timers") },
    ...(hasStability
      ? [
          {
            ...STABILITY_MENU_ITEM,
            title: "My stability program",
            summary: "The stability program your coach gave you: do it and log your holds and reps.",
            route: "Stability",
            onPress: () => navigationRef.navigate("Stability"),
          },
        ]
      : []),
    { ...SUGGESTION_BOX_MENU_ITEM, route: "SuggestionBox", onPress: () => navigationRef.navigate("SuggestionBox") },
    ...rest.map(item),
    // How to use the app, notifications and the welcome on one line (GRIZZ, 2026-10-27).
    { ...HELP_SETTINGS_MENU_ITEM, route: "HelpSettings", onPress: () => navigationRef.navigate("HelpSettings") },
  ];
}

export default function SectionsMenuButton() {
  const navigation = useNavigation();
  const items = useClientMenuItems((check) => navigation.addListener("focus", check));
  return <MenuButton items={items} />;
}
