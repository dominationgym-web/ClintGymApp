import React, { useEffect } from "react";
import { View } from "react-native";
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
import TimersScreen from "@/screens/TimersScreen";
import VideoCheckInScreen from "@/screens/client/VideoCheckInScreen";
import SectionsMenuButton from "@/components/SectionsMenuButton";
import { findSection } from "@/lib/sections";
import DailyStartPopup from "@/components/DailyStartPopup";
import HealthSyncOnOpen from "@/components/HealthSyncOnOpen";
import VideoCheckInDayPopup from "@/components/VideoCheckInDayPopup";
import HelpSettingsScreen from "@/screens/client/HelpSettingsScreen";
import NotificationSettingsScreen from "@/screens/client/NotificationSettingsScreen";
import { groupsOff, loadNotificationPrefs } from "@/lib/notificationPrefs";
import { cancelRemindersForGroups } from "@/lib/notifications";
import { useClientWideScreen } from "@/hooks/useWideScreen";
import ClientSidebar from "@/components/ClientSidebar";
import MyWeekScreen from "@/screens/client/laptop/MyWeekScreen";
import LiftsScreen from "@/screens/client/laptop/LiftsScreen";
import BodyScreen from "@/screens/client/laptop/BodyScreen";
import FoodScreen from "@/screens/client/laptop/FoodScreen";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

const Tab = createBottomTabNavigator<ClientTabParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();

// On a laptop the phone pages sit in a phone-width column in the middle of
// the page, so they look as they do on a phone.
function PhoneColumn({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.columnPage}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}
const phoneColumn = ({ children }: { children: React.ReactNode }) => <PhoneColumn>{children}</PhoneColumn>;
const fullWidth = ({ children }: { children: React.ReactNode }) => <>{children}</>;

function ClientTabs() {
  const { client } = useAuth();
  // Laptop view (GRIZZ, 2026-10-27): the sidebar replaces the bottom tabs and
  // the ☰ menu, and four fuller pages come first.
  const wide = useClientWideScreen();
  return (
    <Tab.Navigator
      tabBar={wide ? () => null : undefined}
      screenLayout={wide ? phoneColumn : undefined}
      screenOptions={{
        headerStyle: { backgroundColor: themeBg("#0F172A") },
        headerTintColor: themeText("#fff"),
        headerRight: wide ? undefined : () => <SectionsMenuButton />,
        tabBarStyle: { backgroundColor: themeBg("#0F172A"), borderTopColor: themeBorder("#1E293B") },
        // So the typing box sits right on the keyboard, not above the tab bar.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: themeText(BRAND_GOLD),
        tabBarInactiveTintColor: themeText("#64748B"),
      }}
    >
      {/* 4 tabs, or 5 with the Reset (app-flow review C1, 2026-10-18): Training sits next
          to Check-in, and form videos are filmed from the set log (Profile keeps the list). */}
      {wide && (
        <>
          <Tab.Screen name="MyWeek" component={MyWeekScreen} options={{ title: "My week", headerShown: false }} layout={fullWidth} />
          <Tab.Screen name="Lifts" component={LiftsScreen} options={{ title: "Weights lifted", headerShown: false }} layout={fullWidth} />
          <Tab.Screen name="Body" component={BodyScreen} options={{ title: "Body & weight", headerShown: false }} layout={fullWidth} />
          <Tab.Screen name="Food" component={FoodScreen} options={{ title: "Nutrition & diet", headerShown: false }} layout={fullWidth} />
        </>
      )}
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
// Brings the client's notification settings onto this phone on open (a new
// phone has none yet), and clears any reminder scheduled meanwhile for a
// group they've switched off.
function useNotificationPrefsSync() {
  const { client } = useAuth();
  const clientId = client?.id;
  useEffect(() => {
    if (!clientId) return;
    loadNotificationPrefs(clientId)
      .then((prefs) => cancelRemindersForGroups(groupsOff(prefs)))
      .catch(() => undefined);
  }, [clientId]);
}

export default function ClientNavigator() {
  useNotificationPrefsSync();
  const wide = useClientWideScreen();
  return (
    <>
      <DailyStartPopup />
      <HealthSyncOnOpen />
      <View style={styles.row}>
        {wide ? <ClientSidebar /> : null}
        <View style={styles.page}>
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: themeBg("#0F172A") }, headerTintColor: themeText("#fff") }} screenLayout={wide ? phoneColumn : undefined}>
            <Stack.Screen name="ClientTabs" component={ClientTabs} options={{ headerShown: false }} layout={fullWidth} />
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
            <Stack.Screen name="VideoCheckIn" component={VideoCheckInScreen} options={{ title: "Video check-in", headerBackTitle: "Back" }} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: "Notifications", headerBackTitle: "Back" }} />
            <Stack.Screen name="HelpSettings" component={HelpSettingsScreen} options={{ title: "Help & settings", headerBackTitle: "Back" }} />
            <Stack.Screen name="FormVideos" component={VideoUploadScreen} options={{ title: "Form videos", headerBackTitle: "Back" }} />
            <Stack.Screen name="Timers" options={{ title: "Timers", headerBackTitle: "Back" }}>
              {({ route }) => <TimersScreen initialTab={route.params?.tab} />}
            </Stack.Screen>
          </Stack.Navigator>
        </View>
      </View>
      <VideoCheckInDayPopup who="client" />
    </>
  );
}

const styles = themedStyles({
  row: { flex: 1, flexDirection: "row", backgroundColor: "#020617" },
  page: { flex: 1 },
  columnPage: { flex: 1, backgroundColor: "#020617", alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: 720, backgroundColor: "#0F172A" },
});
