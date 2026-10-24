import { registerForCoachMessages } from "@/lib/notifications";
import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { tabIcon } from "@/navigation/tabIcon";
import { BRAND_GOLD } from "@/lib/brand";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { TrainerStackParamList, TrainerTabParamList } from "@/navigation/types";
import TrainerDashboardScreen from "@/screens/trainer/TrainerDashboardScreen";
import ClientsScreen from "@/screens/trainer/ClientsScreen";
import GroupLiveScreen from "@/screens/trainer/GroupLiveScreen";
import ClientDetailScreen from "@/screens/trainer/ClientDetailScreen";
import TrainerProfileScreen from "@/screens/trainer/TrainerProfileScreen";
import TrainersScreen from "@/screens/trainer/TrainersScreen";
import BillingScreen from "@/screens/trainer/BillingScreen";
import ProgramsScreen from "@/screens/trainer/ProgramsScreen";
import ProgramBuilderScreen from "@/screens/trainer/ProgramBuilderScreen";
import TrainerSearchScreen from "@/screens/trainer/TrainerSearchScreen";
import { TrainerAppGuideScreen } from "@/screens/AppGuideScreen";
import TrainerGuideScreen from "@/screens/trainer/TrainerGuideScreen";
import { trainerGuide } from "@/lib/trainerGuides";
import TrainerMenuButton from "@/components/TrainerMenuButton";
import SuggestionBoxScreen from "@/screens/SuggestionBoxScreen";
import TrainerProblemsScreen from "@/screens/trainer/TrainerProblemsScreen";
import StabilityScreen from "@/screens/client/StabilityScreen";
import { useAuth } from "@/context/AuthContext";
import ExerciseLibraryScreen from "@/screens/client/ExerciseLibraryScreen";
import { LiveClientProvider } from "@/context/LiveClientContext";
import ReferralPopup from "@/components/ReferralPopup";

const Tab = createBottomTabNavigator<TrainerTabParamList>();
const Stack = createNativeStackNavigator<TrainerStackParamList>();

function TrainerTabs() {
  const { trainer } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
        headerRight: () => <TrainerMenuButton />,
        tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
        // So the typing box sits right on the keyboard, not above the tab bar.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: BRAND_GOLD,
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tab.Screen name="Dashboard" component={TrainerDashboardScreen} options={{ tabBarIcon: tabIcon("speedometer") }} />
      <Tab.Screen name="Clients" component={ClientsScreen} options={{ tabBarIcon: tabIcon("people") }} />
      <Tab.Screen name="Programs" component={ProgramsScreen} options={{ tabBarIcon: tabIcon("barbell") }} />
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
  // So the trainer's phone gets a notification when a client reports pain,
  // fatigue or mental exhaustion (0055). Installed app only.
  useEffect(() => {
    registerForCoachMessages();
  }, []);
  return (
    <>
      <ReferralPopup />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
        <Stack.Screen name="TrainerTabs" component={TrainerTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Client" }} />
        <Stack.Screen
          name="LiveWorkout"
          options={({ route }) => ({
            title: route.params.self ? "My workout" : `Live session · ${route.params.name.split(" ")[0]}`,
            headerBackTitle: "Back",
          })}
        >
          {({ route }) => (
            <LiveClientProvider clientId={route.params.clientId}>
              <ExerciseLibraryScreen />
            </LiveClientProvider>
          )}
        </Stack.Screen>
        <Stack.Screen name="GroupLive" component={GroupLiveScreen} options={{ title: "Group live session", headerBackTitle: "Back" }} />
        <Stack.Screen name="Search" component={TrainerSearchScreen} options={{ title: "Search", headerBackTitle: "Back" }} />
        <Stack.Screen name="SuggestionBox" component={SuggestionBoxScreen} options={{ title: "Suggestion box", headerBackTitle: "Back" }} />
        <Stack.Screen name="TrainerProblems" component={TrainerProblemsScreen} options={{ title: "Problems", headerBackTitle: "Back" }} />
        <Stack.Screen name="Billing" component={BillingScreen} options={{ title: "Billing", headerBackTitle: "Back" }} />
        <Stack.Screen
          name="ProgramBuilder"
          component={ProgramBuilderScreen}
          options={{ title: "Build a program", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="TrainerGuide"
          component={TrainerGuideScreen}
          options={({ route }) => ({ title: trainerGuide(route.params.guideKey)?.title ?? "Guide", headerBackTitle: "Back" })}
        />
        <Stack.Screen name="AppGuide" component={TrainerAppGuideScreen} options={{ title: "How to use the app", headerBackTitle: "Back" }} />
        <Stack.Screen name="Stability" options={{ title: "Stability", headerBackTitle: "Back" }}>
          {({ route }) => <StabilityScreen role="trainer" initialArea={route.params?.area} />}
        </Stack.Screen>
      </Stack.Navigator>
    </>
  );
}
