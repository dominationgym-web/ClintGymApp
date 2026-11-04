import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { ScrollView } from "@/components/ScrollView";
import { themedStyles } from "@/lib/theme";
import { useAuth } from "@/context/AuthContext";
import { diaryKey, diaryNames, splitNames } from "@/lib/calendarRegular";

type Row = { id: string | null; name: string };

// A person who is only a name in the diary has no app, so no meal plan yet
// (GRIZZ, 2026-11-04: the trainer must know why).
const notInApp = (name: string) =>
  Alert.alert(
    `${name} isn't on the app`,
    `${name} can only get the nutrition side (meal plan, macros and shopping list) once they're registered on the app. Give them your trainer code to sign up, then tap one of their sessions on your calendar and choose Link to their app account.`,
  );

// Nutrition tab on the 1 on 1 side (GRIZZ, 2026-11-04): it was hidden in the
// menu. Pick a client and their Diet tab opens (meal plan, BMR and macros).
export default function OneNutritionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { trainer } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!trainer) return;
      const day = 24 * 60 * 60 * 1000;
      Promise.all([
        supabase
          .from("clients")
          .select("id, name, one_on_one, archived_at, access_status")
          .is("archived_at", null)
          .eq("one_on_one", true)
          .order("name"),
        // Diary-only people booked in the last 3 months or the next 2.
        supabase
          .from("live_sessions")
          .select("client_id, guest_name, status")
          .eq("trainer_id", trainer.id)
          .is("client_id", null)
          .gte("starts_at", new Date(Date.now() - 90 * day).toISOString())
          .lt("starts_at", new Date(Date.now() + 60 * day).toISOString()),
      ]).then(([{ data: clients }, { data: sessions }]) => {
        const app: Row[] = (clients ?? []).filter((c) => c.access_status !== "expired").map((c) => ({ id: c.id, name: c.name }));
        const appKeys = new Set(app.map((c) => diaryKey(c.name)));
        const names = diaryNames(sessions ?? []);
        // "Jade & Camilla" is two people.
        const people = [...new Set(names.flatMap((n) => splitNames(n, names)))];
        const diary: Row[] = people.filter((n) => !appKeys.has(diaryKey(n))).map((name) => ({ id: null, name }));
        setRows([...app, ...diary].sort((a, b) => a.name.localeCompare(b.name)));
      });
    }, [trainer]),
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nutrition</Text>
      <Text style={styles.sub}>Select a client to work on their meal plan.</Text>
      {rows === null ? <Text style={styles.meta}>Loading…</Text> : null}
      {rows?.length === 0 ? (
        <Text style={styles.meta}>No 1 on 1 clients yet.</Text>
      ) : null}
      {rows?.map((c) => (
        <Pressable
          key={c.id ?? `diary:${c.name}`}
          style={styles.row}
          onPress={() => (c.id ? navigation.navigate("ClientDetail", { clientId: c.id, tab: "diet" }) : notInApp(c.name))}
          accessibilityRole="button"
        >
          <Text style={[styles.rowText, !c.id && styles.rowTextOff]}>{c.name}</Text>
          {c.id ? <Text style={styles.chevron}>›</Text> : <Text style={styles.tag}>Not on the app</Text>}
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
  rowTextOff: { color: "#94A3B8" },
  tag: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  chevron: { color: BRAND_GOLD, fontWeight: "800", fontSize: 18 },
});
