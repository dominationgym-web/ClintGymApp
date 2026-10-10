import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { SECTIONS } from "@/lib/sections";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { WELCOME_MENU_ITEM } from "@/lib/welcome";

// The client app's menu: the suggestion box first (the coach wants it easy to
// find), then the coach's welcome and the extra sections (Nutrition, ...).
export default function SectionsMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  return (
    <MenuButton
      items={[
        { ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") },
        { ...WELCOME_MENU_ITEM, onPress: () => navigation.navigate("Welcome") },
        ...SECTIONS.map((section) => ({
          key: section.key,
          title: section.title,
          icon: section.icon,
          summary: section.summary,
          onPress: () => navigation.navigate("Section", { sectionKey: section.key }),
        })),
      ]}
    />
  );
}
