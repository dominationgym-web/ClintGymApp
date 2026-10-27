import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import LinkList from "@/components/LinkList";
import { TRAINER_GUIDES } from "@/lib/trainerGuides";

// Every coaching guide on one ☰ menu line (GRIZZ, 2026-10-27).
export const COACHING_GUIDES_MENU_ITEM = {
  key: "coachingGuides",
  title: "Coaching guides",
  icon: "📚",
  summary: "Retention, nutrition, training, recovery, sport and more, written for trainers.",
};

export default function CoachingGuidesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  return (
    <LinkList
      items={TRAINER_GUIDES.map((g) => ({
        key: g.key,
        title: g.title,
        icon: g.icon,
        summary: g.summary,
        onPress: () => navigation.navigate("TrainerGuide", { guideKey: g.key }),
      }))}
    />
  );
}
