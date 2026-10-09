import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { tabIcon } from "@/navigation/tabIcon";
import { BRAND_GOLD } from "@/lib/brand";
import type { ClientTabParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import CheckInScreen from "@/screens/client/CheckInScreen";
import HabitsScreen from "@/screens/client/HabitsScreen";
import LifestyleResetScreen from "@/screens/client/LifestyleResetScreen";
import VideoUploadScreen from "@/screens/client/VideoUploadScreen";
import ExerciseLibraryScreen from "@/screens/client/ExerciseLibraryScreen";
import ClientProfileScreen from "@/screens/client/ClientProfileScreen";

const Tab = createBottomTabNavigator<ClientTabParamList>();

export default function ClientNavigator() {
  const { client } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
        tabBarActiveTintColor: BRAND_GOLD,
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ title: "Check-in", tabBarIcon: tabIcon("checkmark-circle") }} />
      <Tab.Screen name="Habits" component={HabitsScreen} options={{ title: "Habits", tabBarIcon: tabIcon("flame") }} />
      {client?.lifestyle_reset_started_at && (
        <Tab.Screen name="Reset" component={LifestyleResetScreen} options={{ title: "Reset", tabBarIcon: tabIcon("leaf") }} />
      )}
      <Tab.Screen name="Training" component={VideoUploadScreen} options={{ title: "Training", tabBarIcon: tabIcon("barbell") }} />
      <Tab.Screen name="Exercises" component={ExerciseLibraryScreen} options={{ title: "Exercises", tabBarIcon: tabIcon("library") }} />
      <Tab.Screen name="Profile" component={ClientProfileScreen} options={{ title: "Profile", tabBarIcon: tabIcon("person-circle") }} />
    </Tab.Navigator>
  );
}
