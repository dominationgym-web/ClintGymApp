import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { sectionsFor } from "@/lib/sections";
import { useAuth } from "@/context/AuthContext";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { STABILITY_MENU_ITEM } from "@/lib/stability";
import { RECOVERY_MENU_ITEM } from "@/lib/recoveryActivities";
import { supabase } from "@/lib/supabase";
import { TIMER_MENU_ITEM } from "@/lib/timerWorkouts";
import { VIDEO_CHECKIN_MENU_ITEM } from "@/lib/videoCheckins";
import { HELP_SETTINGS_MENU_ITEM } from "@/screens/client/HelpSettingsScreen";
import { COACH_MEAL_PLAN_TITLE, useHasMealPlan } from "@/hooks/useHasMealPlan";

// The client app's menu: Recovery (GRIZZ, 2026-10-17), Nutrition, Cycle tracker (the cycle guide
// and tracker, women only) and Sleep (GRIZZ, 2026-10-12) first, then the
// client's stability program (only once their coach has given them one: the
// trainer runs Stability, 2026-10-14), then
// the suggestion box (the coach wants it easy to find), the other sections
// and Help & settings.
const TOP_SECTIONS = ["nutrition", "womensHealthReset", "sleepRecovery"];

export default function SectionsMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { client } = useAuth();
  const sections = sectionsFor(client?.sex);
  const [hasStability, setHasStability] = useState(false);
  const hasMealPlan = useHasMealPlan(client?.id);
  // Checked whenever the tab comes into view, so a program the coach just gave shows up.
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
    return navigation.addListener("focus", check);
  }, [client, navigation]);
  const first = TOP_SECTIONS.flatMap((key) => sections.filter((s) => s.key === key));
  const rest = sections.filter((s) => !TOP_SECTIONS.includes(s.key));
  const item = (section: (typeof sections)[number]) => ({
    key: section.key,
    title: section.title,
    icon: section.icon,
    summary: section.summary,
    onPress: () => navigation.navigate("Section", { sectionKey: section.key }),
  });
  return (
    <MenuButton
      items={[
        // Straight to the coach's meal plan, used every day (GRIZZ, 2026-10-27).
        ...(hasMealPlan
          ? [
              {
                key: "mealPlan",
                title: "My meal plan",
                icon: "🥗",
                summary: "The meal plan your coach made for you.",
                onPress: () => navigation.navigate("Section", { sectionKey: "nutrition", open: COACH_MEAL_PLAN_TITLE }),
              },
            ]
          : []),
        { ...VIDEO_CHECKIN_MENU_ITEM, onPress: () => navigation.navigate("VideoCheckIn") },
        { ...RECOVERY_MENU_ITEM, onPress: () => navigation.navigate("Recovery") },
        ...first.map(item),
        // EMOM, Tabata and interval timers (GRIZZ, 2026-10-25).
        { ...TIMER_MENU_ITEM, onPress: () => navigation.navigate("Timers") },
        ...(hasStability ? [{ ...STABILITY_MENU_ITEM, title: "My stability program", summary: "The stability program your coach gave you: do it and log your holds and reps.", onPress: () => navigation.navigate("Stability") }] : []),
        { ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") },
        ...rest.map(item),
        // How to use the app, notifications and the welcome on one line (GRIZZ, 2026-10-27).
        { ...HELP_SETTINGS_MENU_ITEM, onPress: () => navigation.navigate("HelpSettings") },
      ]}
    />
  );
}
