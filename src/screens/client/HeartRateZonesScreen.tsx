import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Pressable from "@/components/Pressable";
import { ScrollView } from "@/components/ScrollView";
import SafeBottom from "@/components/SafeBottom";
import HrZoneList from "@/components/HrZoneList";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { HR_EXERCISES, HR_GOALS, buildZones, inputsFromSaved, zoneForGoal } from "@/lib/heartRateZones";
import type { ClientStackParamList } from "@/navigation/types";
import type { ClientHrZones } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// The client's heart rate zones, from their coach (0237, GRIZZ 2026-11-25:
// "so it looks like he's worked everything out for them"). Their green zone in
// big numbers, what each zone does in plain words, and buttons to start a
// session with their strap or watch, or measure their resting heart rate.
export default function HeartRateZonesScreen() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [row, setRow] = useState<ClientHrZones | null>(null);
  const [coach, setCoach] = useState("your coach");
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      Promise.all([
        supabase.from("client_hr_zones").select("*").eq("client_id", client.id).maybeSingle(),
        supabase.from("trainers").select("name").eq("id", client.trainer_id).maybeSingle(),
      ]).then(([{ data }, { data: t }]) => {
        setRow((data as ClientHrZones | null) ?? null);
        const name = (t as { name?: string } | null)?.name?.split(" ")[0];
        if (name) setCoach(`Coach ${name}`);
        setLoading(false);
      });
    }, [client]),
  );

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 40 }} />;

  const inputs = row?.sent_at ? inputsFromSaved(row) : null;
  const zones = inputs ? buildZones(inputs) : null;
  const target = zones && row?.goal ? zoneForGoal(zones, row.goal) : zones?.[1] ?? null;
  const goal = HR_GOALS.find((g) => g.key === row?.goal) ?? HR_GOALS[0];
  const exercise = HR_EXERCISES.find((e) => e.key === row?.exercise)?.label.toLowerCase();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        {zones && target ? (
          <>
            <Text style={styles.kicker}>FROM {coach.toUpperCase()}</Text>
            <Text style={styles.title}>Your heart rate zones</Text>
            <Text style={styles.sub}>I've worked these out for your body and fitness{exercise ? `, for ${exercise}` : ""}.</Text>
            <Pressable
              style={styles.hero}
              onPress={() => navigation.navigate("HeartRate", { mode: "session", zone: target.key })}
              accessibilityRole="button"
              accessibilityLabel="Start the speedometer in your zone"
            >
              <Text style={styles.heroKicker}>TRAIN HERE</Text>
              <Text style={[styles.heroBpm, { color: target.colour }]}>
                {target.low}–{target.high}
              </Text>
              <Text style={styles.heroName}>bpm · {goal.label}</Text>
              <Text style={styles.heroGo}>▶ Tap to start</Text>
            </Pressable>
            <Text style={styles.label}>OR TAP ANY ZONE TO TRAIN IN IT</Text>
            <HrZoneList zones={zones} target={target} mode="about" onPick={(z) => navigation.navigate("HeartRate", { mode: "session", zone: z.key })} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Heart rate zones</Text>
            <Text style={styles.sub}>
              {coach === "your coach" ? "Your coach" : coach} hasn't sent your zones yet. You can measure your resting heart rate now, so they have it when they work them out.
            </Text>
          </>
        )}
        <Pressable style={styles.secondary} onPress={() => navigation.navigate("HeartRate", { mode: "resting" })} accessibilityRole="button">
          <Text style={styles.secondaryText}>
            {row?.measured_resting_hr ? `Resting heart rate ${row.measured_resting_hr} · measure again` : "Measure my resting heart rate (1 min)"}
          </Text>
        </Pressable>
      </ScrollView>
      <SafeBottom />
    </View>
  );
}

const styles = themedStyles({
  page: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, paddingBottom: 24 },
  kicker: { color: "#94A3B8", fontSize: 13, fontWeight: "800", letterSpacing: 0.6 },
  title: { color: "#F1F5F9", fontSize: 24, fontWeight: "800", marginTop: 2 },
  sub: { color: "#94A3B8", fontSize: 14, marginTop: 4, lineHeight: 20 },
  hero: { marginTop: 14, borderRadius: 16, borderWidth: 2, borderColor: "#22C55E", backgroundColor: "#0F2A1E", paddingVertical: 12, alignItems: "center" },
  heroKicker: { color: "#94A3B8", fontSize: 13, fontWeight: "800", letterSpacing: 0.6 },
  heroBpm: { fontSize: 42, fontWeight: "900", letterSpacing: -1 },
  heroName: { color: "#F1F5F9", fontSize: 15, fontWeight: "700" },
  heroGo: { color: "#22C55E", fontSize: 14, fontWeight: "900", marginTop: 6 },
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "800", letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  secondary: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", paddingVertical: 14, alignItems: "center" },
  secondaryText: { color: "#F1F5F9", fontWeight: "700", fontSize: 15 },
  footer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: "#0F172A" },
  main: { backgroundColor: BRAND_GOLD, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  mainText: { color: "#0F172A", fontWeight: "800", fontSize: 17 },
});
