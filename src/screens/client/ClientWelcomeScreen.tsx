import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import WelcomeContent from "@/components/WelcomeContent";

type Props = NativeStackScreenProps<ClientStackParamList, "Welcome">;

// The coach's welcome: once after sign-up (critique, 2026-11-04: it used to come
// before sign-up), and again from the client menu.
export default function ClientWelcomeScreen({ navigation }: Props) {
  return (
    <WelcomeContent
      buttonLabel="Back to the app"
      onPress={() => navigation.goBack()}
      onSkip={() => navigation.goBack()}
      onOpenSuggestionBox={() => navigation.navigate("SuggestionBox")}
    />
  );
}
