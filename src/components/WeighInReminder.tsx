import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { WEIGH_IN_OPTIONS, weighInDueIn, type WeighInEvery } from "@/lib/progress";

// Stays on the Today screen from the day the trainer's weigh-in is due until
// the client logs their weight (a weight in My progress > Body). The phone
// notification only comes once per period (weigh_in_reminders, 0143); this
// card is the reminder that doesn't go away until it's done.
export default function WeighInReminder() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [every, setEvery] = useState<WeighInEvery | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      let cancelled = false;
      (async () => {
        const [c, s] = await Promise.all([
          supabase.from("clients").select("weigh_in_every").eq("id", client.id).maybeSingle(),
          supabase
            .from("client_body_stats")
            .select("measured_on")
            .eq("client_id", client.id)
            .not("weight_kg", "is", null)
            .order("measured_on", { ascending: false })
            .limit(1),
        ]);
        if (cancelled) return;
        const key = (c.data?.weigh_in_every as WeighInEvery | null) ?? null;
        const last = (s.data?.[0] as { measured_on: string } | undefined)?.measured_on ?? null;
        const due = weighInDueIn(key, last, todayIso());
        setEvery(due !== null && due <= 0 ? key : null);
      })();
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  if (!every) return null;
  const label = WEIGH_IN_OPTIONS.find((o) => o.key === every)!.label.toLowerCase();
  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate("ClientTabs", { screen: "Profile", params: { open: "progress" } })} accessibilityRole="button">
      <Text style={styles.title}>⚖️ Weigh-in due</Text>
      <Text style={styles.text}>Your coach asks you to weigh and measure {label}. Add your weight and measurements to clear this.</Text>
      <Text style={styles.link}>Add them now ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  text: { color: "#E2E8F0" },
  link: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600", marginTop: 6 },
});
