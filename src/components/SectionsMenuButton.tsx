import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { SECTIONS } from "@/lib/sections";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { WELCOME_MENU_ITEM } from "@/lib/welcome";

// The client app's menu: the coach's welcome, the extra sections (Nutrition,
// Supplementation, ...) and the suggestion box.
export default function SectionsMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  return (
    <MenuButton
      items={[
        { ...WELCOME_MENU_ITEM, onPress: () => navigation.navigate("Welcome") },
        ...SECTIONS.map((section) => ({
          key: section.key,
          title: section.title,
          summary: section.summary,
          onPress: () => navigation.navigate("Section", { sectionKey: section.key }),
        })),
        { ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") },
      ]}
    />
  );
}
