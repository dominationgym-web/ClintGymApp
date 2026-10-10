import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import TrainerSignupScreen from "@/screens/auth/TrainerSignupScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import { WELCOME_SEEN_KEY } from "@/lib/welcome";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  // Opens on the welcome page until it has been read once on this phone. If
  // the phone's storage can't be read, skip it rather than block login.
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((value) => !cancelled && setWelcomeSeen(value != null))
      .catch(() => !cancelled && setWelcomeSeen(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (welcomeSeen == null) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={welcomeSeen ? "Login" : "Welcome"}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="TrainerSignup" component={TrainerSignupScreen} />
    </Stack.Navigator>
  );
}
