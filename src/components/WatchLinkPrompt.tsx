import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { getHealthLink, healthSourceHere } from "@/lib/healthLink";
import WatchLink from "@/components/WatchLink";

const dismissedKey = (clientId: string) => `watch-prompt-dismissed:${clientId}`;

// A card asking a new client to link their watch (GRIZZ, 2026-10-23: clients
// who sign up with a trainer should be prompted to link their device). Shows
// until they link it or tap Not now; nothing in Expo Go or on a phone with no
// health app, where there is nothing to link. The link itself is on Profile >
// My devices too.
export default function WatchLinkPrompt() {
  const { client } = useAuth();
  const [show, setShow] = useState(false);
  const clientId = client?.id;

  useEffect(() => {
    if (!clientId || !healthSourceHere()) return;
    let live = true;
    (async () => {
      try {
        const [link, dismissed] = await Promise.all([getHealthLink(clientId), AsyncStorage.getItem(dismissedKey(clientId))]);
        if (live) setShow(!link && !dismissed);
      } catch {
        // nothing stored: leave the card off
      }
    })();
    return () => {
      live = false;
    };
  }, [clientId]);

  if (!clientId || !show) return null;

  const notNow = () => {
    setShow(false);
    AsyncStorage.setItem(dismissedKey(clientId), "1").catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>⌚ Link your watch</Text>
      <Text style={styles.body}>Through Apple Health or Samsung Health (Health Connect), your smart watch's runs, rides, walks, swims and sleep reach your coach by themselves. You can also do this later under Profile › My devices.</Text>
      <WatchLink clientId={clientId} onSynced={() => setShow(false)} />
      <Pressable onPress={notNow} hitSlop={8} style={styles.skip}>
        <Text style={styles.skipText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: BRAND_GOLD },
  title: { color: "#fff", fontWeight: "800", fontSize: 16 },
  body: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  skip: { alignItems: "center", marginTop: 10 },
  skipText: { color: "#94A3B8", fontSize: 13, fontWeight: "700" },
});
