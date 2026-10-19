import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { getHealthLink, healthSourceHere, linkHealth, openHealthConnectInStore, syncHealthWorkouts, unlinkHealth } from "@/lib/healthLink";
import { healthAppName, type HealthSource } from "@/lib/healthSync";

// Linking the client's watch (0116): under Other exercise on the Exercises tab,
// and under My devices on their Profile (GRIZZ, 2026-10-18). Once linked, new
// workouts are read in each time this shows; onSynced lets the list reload.
export default function WatchLink({ clientId, onSynced }: { clientId: string; onSynced?: () => void }) {
  const [linked, setLinked] = useState<HealthSource | null>(null);
  const [linking, setLinking] = useState(false);
  const here = healthSourceHere();

  useEffect(() => {
    let live = true;
    getHealthLink(clientId).then(async (link) => {
      if (!live || !link) return;
      setLinked(link.source);
      const added = await syncHealthWorkouts(clientId);
      if (live && added) onSynced?.();
    });
    return () => {
      live = false;
    };
  }, [clientId, onSynced]);

  const link = async () => {
    setLinking(true);
    const result = await linkHealth(clientId);
    if (result === "linked") {
      const source = healthSourceHere();
      setLinked(source);
      const added = await syncHealthWorkouts(clientId);
      onSynced?.();
      Alert.alert(
        "Watch linked",
        `${added ? `${added} workout${added === 1 ? "" : "s"} from the last 2 weeks added to Other exercise. ` : ""}From now on, workouts from ${source ? healthAppName(source) : "your health app"} come in by themselves each time you open the Training tab, and your sleep each time you open the app.`,
      );
    } else if (result === "needs_app") {
      Alert.alert("Health Connect needed", "Your phone needs Google's free Health Connect app. Install it, then tap Link my watch again.", [
        { text: "Not now", style: "cancel" },
        { text: "Get Health Connect", onPress: openHealthConnectInStore },
      ]);
    } else if (result === "denied") {
      Alert.alert("Not linked", "Allow Daily Evolution to read exercise, heart rate, distance and sleep in Health Connect, then try again.");
    } else {
      Alert.alert("Couldn't link", "Your phone's health app isn't available right now.");
    }
    setLinking(false);
  };

  const unlink = () =>
    Alert.alert("Unlink your watch?", "Workouts already added stay. New ones won't come in until you link again.", [
      { text: "Keep linked", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          await unlinkHealth(clientId);
          setLinked(null);
        },
      },
    ]);

  if (linked) {
    return (
      <View style={styles.watchRow}>
        <Text style={styles.watchText}>⌚ Linked to {healthAppName(linked)}: workouts from your watch fill in by themselves.</Text>
        <Pressable onPress={unlink} hitSlop={8}>
          <Text style={styles.unlinkText}>Unlink</Text>
        </Pressable>
      </View>
    );
  }
  if (here) {
    return (
      <Pressable style={styles.watchButton} onPress={link} disabled={linking}>
        <Text style={styles.watchButtonText}>{linking ? "Linking…" : "⌚ Link my watch"}</Text>
        <Text style={styles.watchHint}>
          {here === "apple_health"
            ? "Garmin, Polar, Apple Watch and more, through Apple Health."
            : "Samsung, Garmin, Polar and more, through Health Connect."}
        </Text>
      </Pressable>
    );
  }
  return Platform.OS !== "web" ? <Text style={styles.watchHint}>⌚ Linking your watch comes with the next app update from the store.</Text> : null;
}

const styles = StyleSheet.create({
  watchButton: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center", marginTop: 10 },
  watchButtonText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  watchHint: { color: "#94A3B8", fontSize: 12, marginTop: 6, textAlign: "center" },
  watchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  watchText: { color: "#CBD5E1", fontSize: 12, flex: 1 },
  unlinkText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
});
