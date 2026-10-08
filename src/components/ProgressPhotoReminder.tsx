import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/dates";
import { progressPhotoStatus, type ProgressPhotoStatus } from "@/lib/progressPhotos";
import { latestProgressPhotoDate } from "@/components/progressPhotoData";
import { scheduleProgressPhotoReminder } from "@/lib/notifications";
import type { ClientTabParamList } from "@/navigation/types";

// The 6-week reminder. This banner shows in the app whenever a photo is due,
// and each time it loads it also (re)schedules a phone notification for 9am on
// the next due day. The notification only works in the installed app, not in
// Expo Go, where the banner is the whole reminder.
// Progress photos are optional, so it only reminds clients who have started
// (taken a before photo); nobody gets nagged into a feature they don't want.
export default function ProgressPhotoReminder() {
  const { client } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<ClientTabParamList>>();
  const [status, setStatus] = useState<ProgressPhotoStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      let cancelled = false;
      latestProgressPhotoDate(client.id).then((last) => {
        if (cancelled) return;
        setStatus(progressPhotoStatus(last, todayIso()));
        scheduleProgressPhotoReminder(last);
      }).catch(() => {
        // Offline: no banner this time, and the reminder already on the phone stays.
      });
      return () => {
        cancelled = true;
      };
    }, [client?.id])
  );

  if (!status || status.kind !== "due") return null;
  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate("Profile")}>
      <Text style={styles.text}>
        📸 It's been 6 weeks. Time for your progress photos: front, side and back, full body. Same place, lighting,
        time of day and outfit as before. Tap to start.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: "#22C55E", borderRadius: 8, padding: 12, marginBottom: 16 },
  text: { color: "#E2E8F0", fontWeight: "600" },
});
