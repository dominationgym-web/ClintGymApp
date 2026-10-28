import React from "react";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { useClientWideScreen, useWideScreen } from "@/hooks/useWideScreen";
import RootNavigator from "@/navigation/RootNavigator";
import { setUpNotifications } from "@/lib/notifications";
import { setUpWebAlert } from "@/lib/webAlert";
import { loadThemePreference, themedStyles, useThemeMode, useThemeReady } from "@/lib/theme";

setUpNotifications();
setUpWebAlert();
loadThemePreference();

export default function App() {
  // Switching light/dark remounts the screens so every style is drawn again;
  // RootNavigator keeps the page you were on.
  const mode = useThemeMode();
  const ready = useThemeReady();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style={mode === "light" ? "dark" : "light"} />
        {!ready ? null : Platform.OS === "web" ? (
          <WebFrame key={mode} />
        ) : (
          <RootNavigator key={mode} />
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

const styles = themedStyles({
  webPage: { flex: 1, backgroundColor: "#020617", alignItems: "center" },
  webColumn: { flex: 1, width: "100%", maxWidth: 560, backgroundColor: "#0F172A" },
  webFull: { maxWidth: "100%" },
});
