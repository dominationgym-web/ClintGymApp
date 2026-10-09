import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { tabIcon } from "@/navigation/tabIcon";
import { BRAND_GOLD } from "@/lib/brand";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { TrainerStackParamList, TrainerTabParamList } from "@/navigation/types";
import TrainerDashboardScreen from "@/screens/trainer/TrainerDashboardScreen";
import ClientsScreen from "@/screens/trainer/ClientsScreen";
import ClientDetailScreen from "@/screens/trainer/ClientDetailScreen";
import TrainerProfileScreen from "@/screens/trainer/TrainerProfileScreen";
import TrainersScreen from "@/screens/trainer/TrainersScreen";
import { useAuth } from "@/context/AuthContext";

const Tab = createBottomTabNavigator<TrainerTabParamList>();
const Stack = createNativeStackNavigator<TrainerStackParamList>();

function TrainerTabs() {
  const { trainer } = useAuth();
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
      <Tab.Screen name="Dashboard" component={TrainerDashboardScreen} options={{ tabBarIcon: tabIcon("speedometer") }} />
      <Tab.Screen name="Clients" component={ClientsScreen} options={{ tabBarIcon: tabIcon("people") }} />
      {trainer?.is_owner ? (
        <Tab.Screen name="Trainers" component={TrainersScreen} options={{ tabBarIcon: tabIcon("ribbon") }} />
      ) : null}
      <Tab.Screen
        name="TrainerProfile"
        component={TrainerProfileScreen}
        options={{ title: "Profile", tabBarIcon: tabIcon("person-circle") }}
      />
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
