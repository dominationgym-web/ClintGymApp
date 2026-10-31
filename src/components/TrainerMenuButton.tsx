import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import MenuButton, { type MenuItem } from "@/components/MenuButton";
import { startMyWorkout } from "@/components/MyTraining";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { APP_GUIDE_MENU_ITEM } from "@/lib/appGuide";
import { STABILITY_MENU_ITEM } from "@/lib/stability";
import { OWNER_PROBLEMS_MENU_ITEM, TRAINER_PROBLEMS_MENU_ITEM } from "@/lib/trainerProblems";
import { CHALLENGES_MENU_ITEM } from "@/lib/challenges";
import { useAuth } from "@/context/AuthContext";
import { TIMER_MENU_ITEM } from "@/lib/timerWorkouts";
import { TRAINER_VIDEO_CHECKINS_MENU_ITEM } from "@/lib/videoCheckins";
import { TRAINER_LIVE_SESSIONS_MENU_ITEM } from "@/lib/liveSessions";
import { COACHING_GUIDES_MENU_ITEM } from "@/screens/trainer/CoachingGuidesScreen";

// The trainer app's menu (top right of every trainer tab). The things used
// every week first; the guides share one line (GRIZZ, 2026-10-27).
export default function TrainerMenuButton() {
  return <MenuButton items={useTrainerMenuItems()} />;
}

// The menu's pages, also listed in the laptop sidebar (TrainerSidebar).
export function useTrainerMenuItems(): MenuItem[] {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { trainer } = useAuth();
  return [
    // In-person sessions: calendar, cancellations, month-end invoices (0168).
    { ...TRAINER_LIVE_SESSIONS_MENU_ITEM, route: "LiveSessions", onPress: () => navigation.navigate("LiveSessions") },
    // Weekly video check-ins (0155): free times, bookings and call setup.
    { ...TRAINER_VIDEO_CHECKINS_MENU_ITEM, route: "VideoCheckIns", onPress: () => navigation.navigate("VideoCheckIns") },
    // The trainer's own workout, straight from the menu (was Profile → My training).
    {
      key: "myWorkout",
      title: "My workout",
      icon: "🏋️",
      summary: "Log your own sets, weights and supersets as you train.",
      onPress: () => {
        if (trainer) startMyWorkout(trainer, navigation);
      },
    },
    // The stability programs to give clients (GRIZZ, 2026-10-14: trainer side only),
    // with every exercise's video for 1-on-1 coaching (named by GRIZZ, 2026-10-16).
    {
      ...STABILITY_MENU_ITEM,
      title: "Stability & Rehab programming",
      summary: "Rehab to advanced programs for ankle, knee, hip, core, shoulder, wrist and neck, with a video or examples online for every exercise.",
      route: "Stability",
      onPress: () => navigation.navigate("Stability"),
    },
    // EMOM, Tabata and interval timers, to use or save for a client (GRIZZ, 2026-10-25).
    { ...TIMER_MENU_ITEM, route: "Timers", onPress: () => navigation.navigate("Timers") },
    // One challenge a month for all their clients (0153).
    { ...CHALLENGES_MENU_ITEM, route: "Challenges", onPress: () => navigation.navigate("Challenges") },
    { ...COACHING_GUIDES_MENU_ITEM, route: "CoachingGuides", onPress: () => navigation.navigate("CoachingGuides") },
    { ...APP_GUIDE_MENU_ITEM, route: "AppGuide", onPress: () => navigation.navigate("AppGuide") },
    // Problems go to the owner in the app, linked to the trainer (0151).
    {
      ...(trainer?.is_owner ? OWNER_PROBLEMS_MENU_ITEM : TRAINER_PROBLEMS_MENU_ITEM),
      route: "TrainerProblems",
      onPress: () => navigation.navigate("TrainerProblems"),
    },
    { ...SUGGESTION_BOX_MENU_ITEM, route: "SuggestionBox", onPress: () => navigation.navigate("SuggestionBox") },
  ];
}
