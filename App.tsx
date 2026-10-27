import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { useClientWideScreen, useWideScreen } from "@/hooks/useWideScreen";
import RootNavigator from "@/navigation/RootNavigator";
import { setUpNotifications } from "@/lib/notifications";
import { setUpWebAlert } from "@/lib/webAlert";

setUpNotifications();
setUpWebAlert();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        {Platform.OS === "web" ? (
          <WebFrame />
        ) : (
          <RootNavigator />
        )}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// On a laptop the app sits in a phone-width column down the middle, so every
// screen looks the way it does on a phone. Trainers on a wide window get the
// whole width instead, for their laptop layout, and so do clients (GRIZZ, 2026-10-27).
function WebFrame() {
  const trainerWide = useWideScreen();
  const clientWide = useClientWideScreen();
  const wide = trainerWide || clientWide;
  return (
    <View style={styles.webPage}>
      <View style={[styles.webColumn, wide && styles.webFull]}>
        <RootNavigator />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webPage: { flex: 1, backgroundColor: "#020617", alignItems: "center" },
  webColumn: { flex: 1, width: "100%", maxWidth: 560, backgroundColor: "#0F172A" },
  webFull: { maxWidth: "100%" },
});
