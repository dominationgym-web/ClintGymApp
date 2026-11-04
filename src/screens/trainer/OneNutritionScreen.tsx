import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { ScrollView } from "@/components/ScrollView";
import { themedStyles } from "@/lib/theme";

type Row = { id: string; name: string };

// Nutrition tab on the 1 on 1 side (GRIZZ, 2026-11-04): it was hidden in the
// menu. Pick a client and their Diet tab opens (meal plan, BMR and macros).
export default function OneNutritionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [rows, setRows] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from("clients")
        .select("id, name, one_on_one, archived_at, access_status")
        .is("archived_at", null)
        .eq("one_on_one", true)
        .order("name")
        .then(({ data }) => setRows((data ?? []).filter((c) => c.access_status !== "expired")));
    }, []),
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nutrition</Text>
      <Text style={styles.sub}>Select a client to work on their meal plan.</Text>
      {rows === null ? <Text style={styles.meta}>Loading…</Text> : null}
      {rows?.length === 0 ? (
        <Text style={styles.meta}>No 1 on 1 clients with the app yet. Clients only in your diary need to sign up first.</Text>
      ) : null}
      {rows?.map((c) => (
        <Pressable
          key={c.id}
          style={styles.row}
          onPress={() => navigation.navigate("ClientDetail", { clientId: c.id, tab: "diet" })}
          accessibilityRole="button"
        >
          <Text style={styles.rowText}>{c.name}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = themedStyles({
  page: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  sub: { color: "#94A3B8", fontSize: 14, marginTop: 4, marginBottom: 16 },
  meta: { color: "#94A3B8", fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 8 },
  rowText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  chevron: { color: BRAND_GOLD, fontWeight: "800", fontSize: 18 },
});
