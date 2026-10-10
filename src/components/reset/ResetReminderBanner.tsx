import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { RESET_WEEKS_TOTAL, resetWeek, resetWeekNumber } from "@/lib/resetProgram";
import { getResetReminder } from "@/lib/resetReminderSetting";
import { scheduleResetReminders } from "@/lib/notifications";

// The Reset's daily reminder inside the app. From the time she picked, until
// today's habits are all ticked, this card sits on the Check-in screen. It is
// the whole reminder in Expo Go; the installed app also sends a phone
// notification, which this tops up each time it loads.
export default function ResetReminderBanner() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [text, setText] = useState<string | null>(null);
  const startedOn = client?.lifestyle_reset_started_at ? client.reset_started_on : null;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setText(null);
        if (!client) return;
        if (!startedOn) {
          // Not on the Reset (or her trainer ended it): clear any phone reminders.
          scheduleResetReminders(null, false, "");
          return;
        }
        const week = resetWeekNumber(startedOn, todayIso());
        if (week < 1 || week > RESET_WEEKS_TOTAL) return;
        const setting = await getResetReminder();
        scheduleResetReminders(startedOn, setting.enabled, setting.time);
        const [h, m] = setting.time.split(":").map(Number);
        const now = new Date();
        if (!setting.enabled || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
        const { data } = await supabase
          .from("lifestyle_reset_daily_logs")
          .select("*")
          .eq("client_id", client.id)
          .eq("log_date", todayIso())
          .maybeSingle();
        const habits = resetWeek(week).habits;
        const done = habits.filter((k) => data?.[k]).length;
        if (!cancelled && done < habits.length) setText(`${done} of ${habits.length} ticked so far. Tap to open your Reset.`);
      })();
      return () => {
        cancelled = true;
      };
    }, [client, startedOn])
  );

  if (!text) return null;
  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate("ClientTabs", { screen: "Reset" })}>
      <Text style={styles.title}>🌿 Your Reset today</Text>
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 16 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  text: { color: "#E2E8F0" },
});
