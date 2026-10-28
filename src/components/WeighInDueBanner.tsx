import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { weighInDueIn, type WeighInEvery } from "@/lib/progress";

// "Weigh-in day" in the app as well as on the phone (GRIZZ, 2026-10-26), so a
// client who switched Progress tracking notifications off still sees it when
// they open the app. Tapping opens Profile > My progress.
export default function WeighInDueBanner() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!client) return;
    let live = true;
    Promise.all([
      supabase.from("clients").select("weigh_in_every").eq("id", client.id).maybeSingle(),
      supabase
        .from("client_body_stats")
        .select("measured_on")
        .eq("client_id", client.id)
        .not("weight_kg", "is", null)
        .order("measured_on", { ascending: false })
        .limit(1),
    ]).then(([c, s]) => {
      if (!live) return;
      const every = (c.data?.weigh_in_every as WeighInEvery | null) ?? null;
      const last = (s.data?.[0]?.measured_on as string | undefined) ?? null;
      const dueIn = weighInDueIn(every, last, todayIso());
      setDue(dueIn !== null && dueIn <= 0);
    });
    return () => {
      live = false;
    };
  }, [client]);

  if (!due) return null;
  return (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate("ClientTabs", { screen: "Profile", params: { open: "progress" } })}
      accessibilityRole="button"
    >
      <Text style={styles.title}>⚖️ Weigh-in day</Text>
      <Text style={styles.body}>Tap to add your weight and measurements.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: "#38BDF8", borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  body: { color: "#E2E8F0" },
});
