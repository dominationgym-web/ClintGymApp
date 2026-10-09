import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ClientStackParamList, ClientTabParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import CheckInScreen from "@/screens/client/CheckInScreen";
import HabitsScreen from "@/screens/client/HabitsScreen";
import LifestyleResetScreen from "@/screens/client/LifestyleResetScreen";
import VideoUploadScreen from "@/screens/client/VideoUploadScreen";
import ExerciseLibraryScreen from "@/screens/client/ExerciseLibraryScreen";
import ClientProfileScreen from "@/screens/client/ClientProfileScreen";
import SectionScreen from "@/screens/client/SectionScreen";
import SectionsMenuButton from "@/components/SectionsMenuButton";
import { findSection } from "@/lib/sections";

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
        tabBarActiveTintColor: "#22C55E",
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ title: "Check-in" }} />
      <Tab.Screen name="Habits" component={HabitsScreen} options={{ title: "Habits" }} />
      {client?.lifestyle_reset_started_at && (
        <Tab.Screen name="Reset" component={LifestyleResetScreen} options={{ title: "Reset" }} />
      )}
      <Tab.Screen name="Training" component={VideoUploadScreen} options={{ title: "Training" }} />
      <Tab.Screen name="Exercises" component={ExerciseLibraryScreen} options={{ title: "Exercises" }} />
      <Tab.Screen name="Profile" component={ClientProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

// The tabs sit inside a stack so the header menu can open a section page on
// top of them, with a back button to return to the tab you were on.
export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="Section"
        component={SectionScreen}
        options={({ route }) => ({ title: findSection(route.params.sectionKey)?.title ?? "", headerBackTitle: "Back" })}
      />
    </Stack.Navigator>
  );
}
