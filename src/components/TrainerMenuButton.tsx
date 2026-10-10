import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import MenuButton from "@/components/MenuButton";
import { SUGGESTION_BOX_MENU_ITEM } from "@/lib/suggestions";

// The trainer app's menu (top right of every trainer tab).
export default function TrainerMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  return <MenuButton items={[{ ...SUGGESTION_BOX_MENU_ITEM, onPress: () => navigation.navigate("SuggestionBox") }]} />;
}
