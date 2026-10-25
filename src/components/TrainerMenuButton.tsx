import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { TRAINER_GUIDES } from "@/lib/trainerGuides";
import { APP_GUIDE_MENU_ITEM } from "@/lib/appGuide";
import { STABILITY_MENU_ITEM } from "@/lib/stability";
import { OWNER_PROBLEMS_MENU_ITEM, TRAINER_PROBLEMS_MENU_ITEM } from "@/lib/trainerProblems";
import { useAuth } from "@/context/AuthContext";
import { TRAINER_VIDEO_CHECKINS_MENU_ITEM } from "@/lib/videoCheckins";

// The trainer app's menu (top right of every trainer tab).
export default function TrainerMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { trainer } = useAuth();
  return (
    <MenuButton
      items={[
        { ...APP_GUIDE_MENU_ITEM, onPress: () => navigation.navigate("AppGuide") },
        // Weekly video check-ins (0155): free times, bookings and call setup.
        { ...TRAINER_VIDEO_CHECKINS_MENU_ITEM, onPress: () => navigation.navigate("VideoCheckIns") },
        // The stability programs to give clients (GRIZZ, 2026-10-14: trainer side only),
        // with every exercise's video for 1-on-1 coaching (named by GRIZZ, 2026-10-16).
        {
          ...STABILITY_MENU_ITEM,
          title: "Stability & Rehab programming",
          summary: "Rehab to advanced programs for ankle, knee, hip, core, shoulder, wrist and neck, with a video or examples online for every exercise.",
          onPress: () => navigation.navigate("Stability"),
        },
        ...TRAINER_GUIDES.map((g) => ({
          key: g.key,
          title: g.title,
          icon: g.icon,
          summary: g.summary,
          onPress: () => navigation.navigate("TrainerGuide", { guideKey: g.key }),
        })),
        // Problems go to the owner in the app, linked to the trainer (0151).
        {
          ...(trainer?.is_owner ? OWNER_PROBLEMS_MENU_ITEM : TRAINER_PROBLEMS_MENU_ITEM),
          onPress: () => navigation.navigate("TrainerProblems"),
        },
        { ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") },
      ]}
    />
  );
}
