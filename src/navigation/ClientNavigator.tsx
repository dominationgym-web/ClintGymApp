import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tabIcon } from "@/navigation/tabIcon";
import { BRAND_GOLD } from "@/lib/brand";
import type { ClientStackParamList, ClientTabParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import CheckInScreen from "@/screens/client/CheckInScreen";
import HabitsScreen from "@/screens/client/HabitsScreen";
import LifestyleResetScreen from "@/screens/client/LifestyleResetScreen";
import VideoUploadScreen from "@/screens/client/VideoUploadScreen";
import ExerciseLibraryScreen from "@/screens/client/ExerciseLibraryScreen";
import ClientProfileScreen from "@/screens/client/ClientProfileScreen";
import SectionScreen from "@/screens/client/SectionScreen";
import ClientSearchScreen from "@/screens/client/ClientSearchScreen";
import SuggestionBoxScreen from "@/screens/SuggestionBoxScreen";
import ClientWelcomeScreen from "@/screens/client/ClientWelcomeScreen";
import { ClientAppGuideScreen } from "@/screens/AppGuideScreen";
import StabilityScreen from "@/screens/client/StabilityScreen";
import RecoveryScreen from "@/screens/client/RecoveryScreen";
import SectionsMenuButton from "@/components/SectionsMenuButton";
import { findSection } from "@/lib/sections";
import DailyStartPopup from "@/components/DailyStartPopup";
import HealthSyncOnOpen from "@/components/HealthSyncOnOpen";

const Tab = createBottomTabNavigator<ClientTabParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();

function ClientTabs() {
  const { client } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
        headerRight: () => <SectionsMenuButton />,
        tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
        // So the typing box sits right on the keyboard, not above the tab bar.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: BRAND_GOLD,
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      {/* 4 tabs, or 5 with the Reset (app-flow review C1, 2026-10-18): Training sits next
          to Check-in, and form videos are filmed from the set log (Profile keeps the list). */}
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ title: "Check-in", tabBarIcon: tabIcon("checkmark-circle") }} />
      <Tab.Screen name="Exercises" component={ExerciseLibraryScreen} options={{ title: "Training", tabBarIcon: tabIcon("barbell") }} />
      <Tab.Screen name="Habits" component={HabitsScreen} options={{ title: "Habits", tabBarIcon: tabIcon("flame") }} />
      {client?.lifestyle_reset_started_at && (
        <Tab.Screen name="Reset" component={LifestyleResetScreen} options={{ title: "Reset", tabBarIcon: tabIcon("leaf") }} />
      )}
      <Tab.Screen name="Profile" component={ClientProfileScreen} options={{ title: "Profile", tabBarIcon: tabIcon("person-circle") }} />
    </Tab.Navigator>
  );
}

// The tabs sit inside a stack so the header menu can open a section page on
// top of them, with a back button to return to the tab you were on.
export default function ClientNavigator() {
  return (
    <>
      <DailyStartPopup />
      <HealthSyncOnOpen />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
        <Stack.Screen name="ClientTabs" component={ClientTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Section"
          component={SectionScreen}
          options={({ route }) => ({ title: findSection(route.params.sectionKey)?.title ?? "", headerBackTitle: "Back" })}
        />
        <Stack.Screen name="Search" component={ClientSearchScreen} options={{ title: "Search", headerBackTitle: "Back" }} />
        <Stack.Screen name="SuggestionBox" component={SuggestionBoxScreen} options={{ title: "Suggestion box", headerBackTitle: "Back" }} />
        <Stack.Screen name="Welcome" component={ClientWelcomeScreen} options={{ title: "Welcome", headerBackTitle: "Back" }} />
        <Stack.Screen name="AppGuide" component={ClientAppGuideScreen} options={{ title: "How to use the app", headerBackTitle: "Back" }} />
        <Stack.Screen name="Stability" component={StabilityScreen} options={{ title: "Stability", headerBackTitle: "Back" }} />
        <Stack.Screen name="Recovery" component={RecoveryScreen} options={{ title: "Recovery", headerBackTitle: "Back" }} />
        <Stack.Screen name="FormVideos" component={VideoUploadScreen} options={{ title: "Form videos", headerBackTitle: "Back" }} />
      </Stack.Navigator>
    </>
  );
}
