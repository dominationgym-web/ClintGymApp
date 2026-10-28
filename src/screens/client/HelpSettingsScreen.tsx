import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import LinkList from "@/components/LinkList";
import ThemePicker from "@/components/ThemePicker";
import { APP_GUIDE_MENU_ITEM } from "@/lib/appGuide";
import { NOTIFICATIONS_MENU_ITEM } from "@/lib/notificationPrefs";
import { WELCOME_MENU_ITEM } from "@/lib/welcome";

// The client's once-off pages, on one ☰ menu line so the daily ones stand out (GRIZZ, 2026-10-27).
export const HELP_SETTINGS_MENU_ITEM = {
  key: "helpSettings",
  title: "Help & settings",
  icon: "❓",
  summary: "How to use the app, notifications, light or dark, and your coach's welcome.",
};

export default function HelpSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  return (
    <LinkList
      header={<ThemePicker />}
      items={[
        { ...APP_GUIDE_MENU_ITEM, onPress: () => navigation.navigate("AppGuide") },
        { ...NOTIFICATIONS_MENU_ITEM, onPress: () => navigation.navigate("NotificationSettings") },
        { ...WELCOME_MENU_ITEM, onPress: () => navigation.navigate("Welcome") },
      ]}
    />
  );
}
