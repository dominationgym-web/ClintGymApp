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
import { useTrainerSide } from "@/context/TrainerSideContext";
import { takeMenuReturn } from "@/lib/menuReturn";
import { COACHING_GUIDES_MENU_ITEM } from "@/screens/trainer/CoachingGuidesScreen";
import { HOLIDAYS_MENU_ITEM } from "@/screens/trainer/HolidaysScreen";

// The trainer app's menu (top right of every trainer tab). The things used
// every week first; the guides share one line (GRIZZ, 2026-10-27).
export default function TrainerMenuButton() {
  return <MenuButton items={useTrainerMenuItems()} />;
}

// The menu's pages, also listed in the laptop sidebar (TrainerSidebar).
export function useTrainerMenuItems(): MenuItem[] {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { trainer } = useAuth();
  const { side, evolutionOn, toggleEvolution } = useTrainerSide();
  const problems = {
    ...(trainer?.is_owner ? OWNER_PROBLEMS_MENU_ITEM : TRAINER_PROBLEMS_MENU_ITEM),
    route: "TrainerProblems",
    onPress: () => navigation.navigate("TrainerProblems"),
  };
  // Trainer of the Half-Year (0194): the owner's admin page, on both sides, even while switched off.
  const award: MenuItem[] = trainer?.is_owner
    ? [
        {
          key: "awardAdmin",
          title: "Trainer award",
          icon: "🏆",
          summary: "Trainer of the Half-Year: switch it on, settings, scores, flags, proof videos and winners.",
          route: "AwardAdmin",
          onPress: () => navigation.navigate("AwardAdmin"),
        },
      ]
    : [];
  // The Evolution switch (GRIZZ, 2026-11-06): on both sides, not for the owner.
  const evolutionSwitch: MenuItem[] = trainer?.is_owner
    ? []
    : [
        {
          key: "evolutionSwitch",
          title: evolutionOn ? "Evolution side: on" : "Evolution side: off",
          icon: "🌐",
          summary: evolutionOn
            ? "Your online coaching side is on. Tap to switch it off and stop its subscription."
            : "Switch on your online coaching side: 30 days free, first 5 clients free.",
          onPress: () => {
            // Not a page: don't reopen the menu when the other side's tabs appear.
            takeMenuReturn();
            toggleEvolution();
          },
        },
      ];
  // Holidays (0205): on both sides, the clients see them on their app.
  const holidays: MenuItem = { ...HOLIDAYS_MENU_ITEM, route: "Holidays", onPress: () => navigation.navigate("Holidays") };
  // The 1 on 1 side keeps the menu short (GRIZZ, 2026-11-01: "minimalistic").
  if (side === "one")
    return [
      {
        key: "sessionSetup",
        title: "Session setup",
        icon: "⚙️",
        summary: "Your normal fee, session length, first session time and cancellation rule.",
        route: "LiveSessions",
        onPress: () => navigation.navigate("LiveSessions", { tab: "setup" }),
      },
      holidays,
      // With Evolution off its Clients tab (where sign-ups wait) is hidden, so it's here (0192).
      ...(evolutionOn
        ? []
        : [
            {
              key: "signUps",
              title: "Client sign-ups",
              icon: "📝",
              summary: "Clients who signed up with your code and are waiting for you to activate them.",
              route: "SignUps",
              onPress: () => navigation.navigate("SignUps"),
            },
          ]),
      ...evolutionSwitch,
      ...award,
      { ...TIMER_MENU_ITEM, route: "Timers", onPress: () => navigation.navigate("Timers") },
      { ...APP_GUIDE_MENU_ITEM, route: "AppGuide", onPress: () => navigation.navigate("AppGuide") },
      problems,
      { ...SUGGESTION_BOX_MENU_ITEM, route: "SuggestionBox", onPress: () => navigation.navigate("SuggestionBox") },
    ];
  return [
    // Weekly video check-ins (0155): free times, bookings and call setup.
    { ...TRAINER_VIDEO_CHECKINS_MENU_ITEM, route: "VideoCheckIns", onPress: () => navigation.navigate("VideoCheckIns") },
    holidays,
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
    // One file with all clients' history from an old app or spreadsheet (0190).
    {
      key: "bulkImport",
      title: "Client history from a file",
      icon: "📥",
      summary: "One file with all your clients' past training: the app splits it by name and adds it to each client.",
      route: "BulkImport",
      onPress: () => navigation.navigate("BulkImport"),
    },
    { ...COACHING_GUIDES_MENU_ITEM, route: "CoachingGuides", onPress: () => navigation.navigate("CoachingGuides") },
    // Client tools first, then the trainer's own workout, then help (critique, 2026-11-04).
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
    ...evolutionSwitch,
    ...award,
    { ...APP_GUIDE_MENU_ITEM, route: "AppGuide", onPress: () => navigation.navigate("AppGuide") },
    // Problems go to the owner in the app, linked to the trainer (0151).
    problems,
    { ...SUGGESTION_BOX_MENU_ITEM, route: "SuggestionBox", onPress: () => navigation.navigate("SuggestionBox") },
  ];
}
