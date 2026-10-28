import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import * as Updates from "expo-updates";
import { BRAND_GOLD } from "@/lib/brand";

// Replaces the weekly "Get the latest Daily Evolution" push for clients
// (GRIZZ, 2026-10-26: a banner when they open the app instead). Checks for a
// new update each time the app opens, downloads it, then offers to load it.
// Shows nothing in development or Expo Go, where updates are off.
export default function AppUpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    let live = true;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        // Already downloaded in the background counts too: it still needs a reload.
        await Updates.fetchUpdateAsync();
        if (live) setReady(true);
      } catch {
        // Offline or the update server is busy: try again next open.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!ready) return null;
  return (
    <Pressable
      style={styles.card}
      onPress={() => Updates.reloadAsync().catch(() => undefined)}
      accessibilityRole="button"
    >
      <Text style={styles.title}>✨ New app update ready</Text>
      <Text style={styles.body}>Tap to load this week's improvements. It takes a few seconds.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  body: { color: "#E2E8F0" },
});
