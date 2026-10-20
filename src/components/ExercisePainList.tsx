import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { painAreaLabel, shortDate, type ExercisePain } from "@/lib/painSwap";

// "This hurts" (0129), on the client's Training tab under the injury check:
// which exercises hurt them in the last 8 weeks, where, and what they tried
// instead. To change it for good, tap the exercise in their program or
// calendar day (ExerciseChangeModal).
export default function ExercisePainList({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [rows, setRows] = useState<ExercisePain[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 56);
    supabase
      .from("client_exercise_pain")
      .select("*")
      .eq("client_id", clientId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [clientId]);
  if (rows.length === 0) return null;
  const shown = open ? rows : rows.slice(0, 3);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>😣 Exercises that hurt {clientName}</Text>
      {shown.map((r) => (
        <Text key={r.id} style={styles.line}>
          <Text style={styles.name}>{r.exercise_name}</Text> hurt their {painAreaLabel(r.area).toLowerCase()} ({shortDate(r.created_at)})
          {r.tried_name ? `, tried ${r.tried_name} instead` : ", left it out"}
        </Text>
      ))}
      {rows.length > 3 && (
        <Pressable onPress={() => setOpen((v) => !v)} hitSlop={6}>
          <Text style={styles.more}>{open ? "Show fewer ▴" : `Show all ${rows.length} ▾`}</Text>
        </Pressable>
      )}
      <Text style={styles.small}>To change one for good, tap it in their program or on a calendar day.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: "#F87171" },
  title: { color: "#FCA5A5", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  name: { color: "#fff", fontWeight: "700" },
  more: { color: "#94A3B8", fontWeight: "700", marginTop: 8 },
  small: { color: "#64748B", fontSize: 12, marginTop: 8 },
});
