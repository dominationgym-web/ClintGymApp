import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { TRAINER_GUIDES } from "@/lib/trainerGuides";
import { APP_GUIDE_MENU_ITEM } from "@/lib/appGuide";
import { STABILITY_MENU_ITEM } from "@/lib/stability";

// The trainer app's menu (top right of every trainer tab).
export default function TrainerMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  return (
    <MenuButton
      items={[
        { ...APP_GUIDE_MENU_ITEM, onPress: () => navigation.navigate("AppGuide") },
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
        { ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") },
      ]}
    />
  );
}
