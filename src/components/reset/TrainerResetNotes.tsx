import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import type { LifestyleResetDailyLog } from "@/types/database";
import { FEELINGS, HELPED_OPTIONS, RESET_HABITS } from "@/lib/resetProgram";

// For the trainer: her last two weeks on the Reset, with how she felt, whether
// it's helping, her note and how many habits she ticked each day.
export default function TrainerResetNotes({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<LifestyleResetDailyLog[]>([]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    supabase
      .from("lifestyle_reset_daily_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("log_date", toIsoDate(since))
      .order("log_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [clientId]);

  if (rows.length === 0) return <Text style={styles.empty}>Nothing logged in the last two weeks.</Text>;

  return (
    <View>
      {rows.map((r) => {
        const ticks = RESET_HABITS.filter((h) => r[h.key]).length;
        const feeling = FEELINGS.find((f) => f.value === r.feeling);
        const helped = HELPED_OPTIONS.find((o) => o.value === r.helped);
        return (
          <View key={r.log_date} style={styles.row}>
            <Text style={styles.date}>
              {parseIsoDate(r.log_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              {"  ·  "}
              {ticks} ticked
              {feeling ? `  ·  ${feeling.emoji} ${feeling.label}` : ""}
              {helped ? `  ·  Helping: ${helped.label}` : ""}
            </Text>
            {r.note && <Text style={styles.note}>{r.note}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#64748B", fontSize: 12.5, marginTop: 8 },
  row: { borderTopWidth: 1, borderTopColor: "#0F172A", paddingVertical: 6 },
  date: { color: "#CBD5E1", fontSize: 12.5 },
  note: { color: "#E2E8F0", fontSize: 13.5, lineHeight: 19, marginTop: 2 },
});
