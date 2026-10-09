import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { currentNightTip, isWindDownTime } from "@/lib/sleep";
import { getSleepReminderEnabled } from "@/lib/sleepReminderSetting";
import { scheduleSleepReminders } from "@/lib/notifications";
import { BRAND_GOLD } from "@/lib/brand";

// The nightly sleep tip. From 6pm this card shows tonight's tip in the app,
// and each time it loads it also tops up the 6pm phone notifications for the
// next two weeks. The notifications only work in the installed app, not in
// Expo Go, where the card is the whole reminder. Clients can turn both off in
// Sleep & Recovery.
export default function SleepReminder() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [tip, setTip] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSleepReminderEnabled().then((enabled) => {
        if (cancelled) return;
        scheduleSleepReminders(enabled);
        const now = new Date();
        setTip(enabled && isWindDownTime(now) ? currentNightTip(now) : null);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!tip) return null;
  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate("Section", { sectionKey: "sleepRecovery" })}>
      <Text style={styles.title}>🌙 Time to start winding down</Text>
      <Text style={styles.text}>{tip}</Text>
      <Text style={styles.link}>More sleep tips</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 16 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  text: { color: "#E2E8F0" },
  link: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600", marginTop: 6 },
});
