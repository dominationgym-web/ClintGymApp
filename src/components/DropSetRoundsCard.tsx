import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { formatRoundTime } from "@/lib/dropSets";
import type { DropSetRound } from "@/types/database";

// Trainer view (GRIZZ, 2026-10-16): the client's recent drop set rounds, one
// line per session: exercise, date, then each round's time, drops and reps.
// Hidden when they haven't done any.
export default function DropSetRoundsCard({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<DropSetRound[]>([]);
  useEffect(() => {
    supabase
      .from("drop_set_rounds")
      .select("*")
      .eq("client_id", clientId)
      .order("log_date", { ascending: false })
      .order("round_number", { ascending: true })
      .limit(60)
      .then(({ data }) => setRows((data as DropSetRound[]) ?? []));
  }, [clientId]);
  if (!rows.length) return null;
  const groups: { key: string; name: string; date: string; rounds: DropSetRound[] }[] = [];
  for (const r of rows) {
    const key = `${r.log_date}|${r.exercise_name}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, name: r.exercise_name, date: r.log_date, rounds: [] }));
    g.rounds.push(r);
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>⬇️ Drop set rounds</Text>
      {groups.slice(0, 8).map((g) => (
        <Text key={g.key} style={styles.line}>
          {g.date} · {g.name}:{" "}
          {g.rounds.map((r) => `R${r.round_number} ${formatRoundTime(r.seconds)} (${r.drops} drops, ${r.total_reps} reps)`).join(" · ")}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 10 },
  title: { color: "#F8FAFC", fontWeight: "700", marginBottom: 4 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 3 },
});
