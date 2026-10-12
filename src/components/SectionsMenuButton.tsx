import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { sectionsFor } from "@/lib/sections";
import { useAuth } from "@/context/AuthContext";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";
import { WELCOME_MENU_ITEM } from "@/lib/welcome";
import { APP_GUIDE_MENU_ITEM } from "@/lib/appGuide";

// The client app's menu: Women's Health Reset (with the cycle tracker) first
// for women (GRIZZ, 2026-10-12), then the suggestion box (the coach wants it
// easy to find), how to use the app, the coach's welcome and the other
// sections (Nutrition, ...).
export default function SectionsMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { client } = useAuth();
  const sections = sectionsFor(client?.sex);
  const first = sections.filter((s) => s.key === "womensHealthReset");
  const rest = sections.filter((s) => s.key !== "womensHealthReset");
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
        ...first.map(item),
        { ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") },
        { ...APP_GUIDE_MENU_ITEM, onPress: () => navigation.navigate("AppGuide") },
        { ...WELCOME_MENU_ITEM, onPress: () => navigation.navigate("Welcome") },
        ...rest.map(item),
      ]}
    />
  );
}
