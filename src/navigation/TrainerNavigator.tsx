import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { TrainerStackParamList, TrainerTabParamList } from "@/navigation/types";
import TrainerDashboardScreen from "@/screens/trainer/TrainerDashboardScreen";
import ClientsScreen from "@/screens/trainer/ClientsScreen";
import ClientDetailScreen from "@/screens/trainer/ClientDetailScreen";

const Tab = createBottomTabNavigator<TrainerTabParamList>();
const Stack = createNativeStackNavigator<TrainerStackParamList>();

function TrainerTabs() {
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
      <Tab.Screen name="Dashboard" component={TrainerDashboardScreen} />
      <Tab.Screen name="Clients" component={ClientsScreen} />
    </Tab.Navigator>
  );
}

export default function TrainerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
      <Stack.Screen name="TrainerTabs" component={TrainerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Client" }} />
    </Stack.Navigator>
  );
}
