import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { TRAINER_GUIDES } from "@/lib/trainerGuides";
import { APP_GUIDE_MENU_ITEM } from "@/lib/appGuide";

// The trainer app's menu (top right of every trainer tab).
export default function TrainerMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  return (
    <MenuButton
      items={[
        { ...APP_GUIDE_MENU_ITEM, onPress: () => navigation.navigate("AppGuide") },
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
