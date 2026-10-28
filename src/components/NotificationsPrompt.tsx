import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { notificationPermission, turnOnNotifications, type NotificationPermission } from "@/lib/notifications";
import { themedStyles } from "@/lib/theme";

const WHY = {
  client: "So you hear straight away from your trainer, and before your plan runs out.",
  trainer: "So you hear straight away about new sign-ups and when a client reports pain, fatigue or stress.",
};

// A card asking to turn notifications on, shown until they are. If the phone
// has blocked them, the button opens the phone's settings for this app.
// Hidden in Expo Go, which can't do notifications.
export default function NotificationsPrompt({ who }: { who: "client" | "trainer" }) {
  const [permission, setPermission] = useState<NotificationPermission>("unavailable");

  const check = useCallback(() => {
    notificationPermission().then(setPermission);
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => subscription.remove();
  }, [check]);

  if (permission === "granted" || permission === "unavailable") return null;

  const onPress = async () => {
    if (permission === "blocked") {
      Linking.openSettings();
      return;
    }
    await turnOnNotifications();
    check();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🔔 Turn on notifications</Text>
      <Text style={styles.body}>{WHY[who]}</Text>
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>{permission === "blocked" ? "Open settings" : "Turn on"}</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: BRAND_GOLD },
  title: { color: "#fff", fontWeight: "800", fontSize: 16 },
  body: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 10, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "800" },
});
