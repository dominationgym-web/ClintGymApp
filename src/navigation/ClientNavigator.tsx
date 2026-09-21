import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
