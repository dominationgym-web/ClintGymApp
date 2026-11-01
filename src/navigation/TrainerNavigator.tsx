import { registerForCoachMessages } from "@/lib/notifications";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { StackActions } from "@react-navigation/native";
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
import CoachingGuidesScreen from "@/screens/trainer/CoachingGuidesScreen";
import TrainerGuideScreen from "@/screens/trainer/TrainerGuideScreen";
import { trainerGuide } from "@/lib/trainerGuides";
import TrainerMenuButton from "@/components/TrainerMenuButton";
import SuggestionBoxScreen from "@/screens/SuggestionBoxScreen";
import TrainerProblemsScreen from "@/screens/trainer/TrainerProblemsScreen";
import ChallengesScreen from "@/screens/trainer/ChallengesScreen";
import VideoCheckInsScreen from "@/screens/trainer/VideoCheckInsScreen";
import LiveSessionsScreen from "@/screens/trainer/LiveSessionsScreen";
import { TrainerSideProvider, TrainerSideSwitch, useTrainerSide } from "@/context/TrainerSideContext";
import StabilityScreen from "@/screens/client/StabilityScreen";
import { useAuth } from "@/context/AuthContext";
import ExerciseLibraryScreen from "@/screens/client/ExerciseLibraryScreen";
import { LiveClientProvider } from "@/context/LiveClientContext";
import ReferralPopup from "@/components/ReferralPopup";
import TimersScreen from "@/screens/TimersScreen";
import VideoCheckInDayPopup from "@/components/VideoCheckInDayPopup";
import TrainerSidebar, { useCurrentRoute } from "@/components/TrainerSidebar";
import ClientListPanel from "@/components/ClientListPanel";
import { useWideScreen } from "@/hooks/useWideScreen";
import { navigationRef } from "@/navigation/navigationRef";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

const Tab = createBottomTabNavigator<TrainerTabParamList>();
const Stack = createNativeStackNavigator<TrainerStackParamList>();

// The 1 on 1 side's tabs: one page each of the live sessions screen.
const OneToday = () => <LiveSessionsScreen only="todo" />;
const OneCalendar = () => <LiveSessionsScreen only="calendar" />;
const OneClients = () => <LiveSessionsScreen only="clients" />;
const OneInvoices = () => <LiveSessionsScreen only="invoices" />;

function TrainerTabs() {
  const { trainer } = useAuth();
  // 1 on 1 or Evolution (GRIZZ, 2026-11-01): the switch sits in the header.
  const { side } = useTrainerSide();
  // On a laptop the sidebar has every tab and menu page (TrainerSidebar).
  const wide = useWideScreen();
  return (
    <Tab.Navigator
      tabBar={wide ? () => null : undefined}
      screenOptions={{
        headerStyle: { backgroundColor: themeBg("#0F172A") },
        headerTintColor: themeText("#fff"),
        headerRight: wide ? undefined : () => <TrainerMenuButton />,
        headerTitle: wide ? undefined : () => <TrainerSideSwitch />,
        headerTitleAlign: "left",
        tabBarStyle: { backgroundColor: themeBg("#0F172A"), borderTopColor: themeBorder("#1E293B") },
        // So the typing box sits right on the keyboard, not above the tab bar.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: themeText(BRAND_GOLD),
        tabBarInactiveTintColor: themeText("#64748B"),
      }}
    >
      {side === "one" ? (
        <>
          <Tab.Screen name="OneToday" component={OneToday} options={{ title: "Today", tabBarIcon: tabIcon("today") }} />
          <Tab.Screen name="OneCalendar" component={OneCalendar} options={{ title: "Calendar", tabBarIcon: tabIcon("calendar") }} />
          <Tab.Screen name="OneClients" component={OneClients} options={{ title: "Clients", tabBarIcon: tabIcon("people") }} />
          <Tab.Screen name="OneInvoices" component={OneInvoices} options={{ title: "Invoices", tabBarIcon: tabIcon("receipt") }} />
        </>
      ) : (
        <>
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
        </>
      )}
    </Tab.Navigator>
  );
}

export default function TrainerNavigator() {
  // So the trainer's phone gets a notification when a client reports pain,
  // fatigue or mental exhaustion (0055). Installed app only.
  useEffect(() => {
    registerForCoachMessages();
  }, []);
  // Laptop layout (GRIZZ, 2026-10-27): the sidebar, and the client list beside
  // the Clients tab and each client's page. The stack stays in the same place
  // either way, so resizing the window never loses the page that's open.
  const wide = useWideScreen();
  const current = useCurrentRoute();
  const onClients = current?.name === "Clients" || current?.name === "ClientDetail";
  const openClientId = current?.name === "ClientDetail" ? (current.params?.clientId as string | undefined) : undefined;
  // The list loads again on coming back to the Clients tab, e.g. after archiving a client.
  const [clientsReload, setClientsReload] = useState(0);
  useEffect(() => {
    if (current?.name === "Clients") setClientsReload((k) => k + 1);
  }, [current?.name]);
  const openClient = (clientId: string) => {
    if (clientId === openClientId) return;
    // One client page at a time, so Back still goes to where the trainer came from.
    if (openClientId) navigationRef.dispatch(StackActions.replace("ClientDetail", { clientId }));
    else navigationRef.navigate("ClientDetail", { clientId });
  };
  return (
    <TrainerSideProvider>
      <ReferralPopup />
      <View style={styles.row}>
        {wide ? <TrainerSidebar /> : null}
        {wide && onClients ? (
          <View style={styles.clientList}>
            <ClientListPanel selectedId={openClientId} reloadKey={clientsReload} onOpen={openClient} />
          </View>
        ) : null}
        <View style={styles.page}>
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: themeBg("#0F172A") }, headerTintColor: themeText("#fff") }}>
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
            <Stack.Screen name="Challenges" component={ChallengesScreen} options={{ title: "Monthly challenges", headerBackTitle: "Back" }} />
            <Stack.Screen name="VideoCheckIns" component={VideoCheckInsScreen} options={{ title: "Video check-ins", headerBackTitle: "Back" }} />
            <Stack.Screen name="LiveSessions" component={LiveSessionsScreen} options={{ title: "Live sessions", headerBackTitle: "Back" }} />
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
            <Stack.Screen name="CoachingGuides" component={CoachingGuidesScreen} options={{ title: "Coaching guides", headerBackTitle: "Back" }} />
            <Stack.Screen name="AppGuide" component={TrainerAppGuideScreen} options={{ title: "How to use the app", headerBackTitle: "Back" }} />
            <Stack.Screen name="Timers" options={{ title: "Timers", headerBackTitle: "Back" }}>
              {() => <TimersScreen />}
            </Stack.Screen>
            <Stack.Screen name="Stability" options={{ title: "Stability", headerBackTitle: "Back" }}>
              {({ route }) => <StabilityScreen role="trainer" initialArea={route.params?.area} />}
            </Stack.Screen>
          </Stack.Navigator>
        </View>
      </View>
      <VideoCheckInDayPopup who="trainer" />
    </TrainerSideProvider>
  );
}

const styles = themedStyles({
  row: { flex: 1, flexDirection: "row" },
  clientList: { width: 360, borderRightWidth: 1, borderRightColor: "#1E293B" },
  page: { flex: 1 },
});
