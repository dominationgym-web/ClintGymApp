import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import WelcomeContent from "@/components/WelcomeContent";
import { WELCOME_SEEN_KEY } from "@/lib/welcome";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

// The coach's introduction, shown the first time the app is opened, before
// signup. The button remembers it was read and opens the signup screen, with
// the login screen behind it for people who already have an account.
export default function WelcomeScreen({ navigation }: Props) {
  const continueToSignup = () => {
    AsyncStorage.setItem(WELCOME_SEEN_KEY, "1").catch(() => {});
    navigation.reset({ index: 1, routes: [{ name: "Login" }, { name: "Signup" }] });
  };

  return <WelcomeContent buttonLabel="I'm ready, let's get started" onPress={continueToSignup} padTop />;
}
