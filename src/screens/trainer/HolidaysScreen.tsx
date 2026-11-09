import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { useAuth } from "@/context/AuthContext";
import { useCoachHolidays } from "@/hooks/useCoachHolidays";
import { holidaySpan, upcomingHolidays, type Holiday } from "@/lib/holidays";
import { todayIso } from "@/lib/dates";
import HolidayModal from "@/components/sessions/HolidayModal";
import { themedStyles } from "@/lib/theme";

export const HOLIDAYS_MENU_ITEM = {
  key: "holidays",
  title: "My holidays",
  icon: "🌴",
  summary: "Load the days you're away. Your clients see them on their app and get a reminder the day before.",
};

// The trainer's holidays (GRIZZ, 2026-11-09), on both sides of the app.
export default function HolidaysScreen() {
  const { trainer } = useAuth();
  const { holidays, reload } = useCoachHolidays(trainer?.id);
  const [adding, setAdding] = useState(false);
  const today = todayIso();
  const list = upcomingHolidays(holidays, today);

  const takeOff = (h: Holiday) =>
    Alert.alert(
      "Take this holiday off?",
      "Your clients stop seeing it. Sessions it cancelled stay cancelled and stay on your catch-up list: book them again if you need to.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Take it off",
          onPress: async () => {
            const { error } = await supabase.rpc("remove_trainer_time_off", { p_id: h.id });
            if (error) return Alert.alert("Couldn't take it off", error.message);
            reload();
          },
        },
      ]
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.helper}>
        Tap the days you're away. Every client is told and sees it on their app until you're back. 1 on 1 sessions in that time are cancelled free and go on your catch-up list, where you book a catch-up or credit each one.
      </Text>
      <Pressable style={styles.button} onPress={() => setAdding(true)}>
        <Text style={styles.buttonText}>＋ Add a holiday</Text>
      </Pressable>
      {list.length ? <Text style={styles.label}>Coming up</Text> : <Text style={styles.helper}>No holidays loaded.</Text>}
      {list.map((h) => (
        <View key={h.id} style={styles.row}>
          <Text style={styles.rowTitle}>🌴 Away {holidaySpan(h, today)}</Text>
          {h.reason ? <Text style={styles.meta}>{h.reason}</Text> : null}
          {h.missed ? <Text style={styles.meta}>Catch-up list: {h.missed} session{h.missed === 1 ? "" : "s"} to book or credit</Text> : null}
          <Pressable onPress={() => takeOff(h)} hitSlop={8}>
            <Text style={styles.link}>Take it off</Text>
          </Pressable>
        </View>
      ))}
      <HolidayModal
        visible={adding}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          reload();
        }}
      />
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  row: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#38BDF8" },
  rowTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginTop: 8 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
});
