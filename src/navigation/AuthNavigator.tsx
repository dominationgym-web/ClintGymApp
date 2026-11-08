import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import TrainerSignupScreen from "@/screens/auth/TrainerSignupScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Opens on Log in. The coach's welcome used to come first, before sign-up; it
// now shows once inside the app after sign-up (critique, 2026-11-04). The
// Welcome route stays so an old link to it still works.
export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="TrainerSignup" component={TrainerSignupScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
    </Stack.Navigator>
  );
}
