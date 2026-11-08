import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { longDate, nextGoal } from "@/lib/award";
import { todayIso } from "@/lib/dates";
import { themedStyles } from "@/lib/theme";

interface Counter {
  count: number;
  goals: number[];
  start_at: number;
  first_start: string | null;
  enabled: boolean;
  prize_now: string | null;
  next_tier: { trainers: number; prize: string } | null;
}

const n = (x: number) => x.toLocaleString("en-ZA");

// The owner's trainer counter (GRIZZ, 2026-11-08): approved trainers on the
// app against his goals (1 000, then 5 000), when Trainer of the Half-Year
// starts (250 trainers) and the prize the next tier brings. Owner only.
export default function TrainerCounter() {
  const [c, setC] = useState<Counter | null>(null);
  useFocusEffect(
    useCallback(() => {
      supabase.rpc("award_trainer_counter").then(({ data }) => setC((data as Counter | null) ?? null));
    }, [])
  );
  if (!c) return null;
  const goal = nextGoal(c.goals ?? [], c.count);
  const pct = goal ? Math.min(100, (100 * c.count) / goal) : 100;
  const toStart = c.start_at - c.count;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.count}>{n(c.count)}</Text>
        <Text style={styles.label}>trainers on the app</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.text}>
        {goal ? `${n(goal - c.count)} to go to ${n(goal)}` : `Every goal reached (${(c.goals ?? []).map(n).join(", ")}) 🎉`}
      </Text>
      <Text style={styles.hint}>
        {c.first_start
          ? `Trainer of the Half-Year ${c.first_start > todayIso() ? "starts" : "started"} ${longDate(c.first_start)}${c.enabled ? "" : " (switched off)"}.`
          : toStart > 0
            ? `Trainer of the Half-Year starts at ${n(c.start_at)} trainers: ${n(toStart)} to go${c.enabled ? "" : " (switched off)"}.`
            : `${n(c.start_at)} trainers reached. ${c.enabled ? "The award starts on the 1st of next month." : "Switch the award on to start it."}`}
        {c.prize_now ? ` Prize now: ${c.prize_now}.` : ""}
        {c.next_tier ? ` At ${n(c.next_tier.trainers)}: ${c.next_tier.prize}.` : ""}
      </Text>
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 12, gap: 6 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  count: { color: BRAND_GOLD, fontWeight: "800", fontSize: 28 },
  label: { color: "#E2E8F0", fontWeight: "600" },
  bar: { height: 8, borderRadius: 4, backgroundColor: "#334155", overflow: "hidden" },
  fill: { height: 8, backgroundColor: BRAND_GOLD },
  text: { color: "#fff", fontWeight: "600" },
  hint: { color: "#94A3B8", fontSize: 13, lineHeight: 18 },
});
