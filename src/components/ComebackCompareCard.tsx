import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { toIsoDate, todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import {
  compareIntake,
  compareLifts,
  compareStints,
  daysBetween,
  summarizeStint,
  type CompareRow,
  type StintData,
} from "@/lib/comeback";
import type { Client } from "@/types/database";

// A returning client's first time with the trainer against the time since
// they came back (0097). Shown on the trainer's client Overview once a client
// has been brought back from the archive.

const PAGE = 1000;

// Supabase returns at most 1000 rows a request, so read a stint page by page.
async function allRows<T>(table: string, columns: string, dateCol: string, clientId: string, from: string, to: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 20; page++) {
    const { data } = await supabase
      .from(table as "checkins")
      .select(columns)
      .eq("client_id", clientId)
      .gte(dateCol, from)
      .lte(dateCol, to)
      .order(dateCol)
      .range(page * PAGE, page * PAGE + PAGE - 1);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function loadStint(clientId: string, from: string, to: string): Promise<StintData> {
  const [checkins, sessions, sets] = await Promise.all([
    allRows<StintData["checkins"][number]>("checkins", "sleep_quality, water_litres, alcohol_units", "checkin_date", clientId, from, to),
    allRows<StintData["sessions"][number]>("workout_sessions", "status, star", "session_date", clientId, from, to),
    allRows<StintData["sets"][number]>("workout_logs", "exercise_name, weight_kg, warm_up", "log_date", clientId, from, to),
  ]);
  return { days: daysBetween(from, to), checkins, sessions, sets };
}

export default function ComebackCompareCard({ client }: { client: Client }) {
  const [rows, setRows] = useState<{ habits: CompareRow[]; lifts: CompareRow[]; intake: CompareRow[] } | null>(null);
  const thenFrom = toIsoDate(new Date(client.created_at));
  const thenTo = client.first_stint_ended_at ? toIsoDate(new Date(client.first_stint_ended_at)) : null;
  const nowFrom = client.returned_at ? toIsoDate(new Date(client.returned_at)) : null;

  useEffect(() => {
    if (!thenTo || !nowFrom) return;
    let live = true;
    Promise.all([loadStint(client.id, thenFrom, thenTo), loadStint(client.id, nowFrom, todayIso())]).then(([a, b]) => {
      if (!live) return;
      const then = summarizeStint(a);
      const now = summarizeStint(b);
      setRows({
        habits: compareStints(then, now),
        lifts: compareLifts(then, now),
        intake: compareIntake(client.first_intake_responses, client.intake_responses),
      });
    });
    return () => {
      live = false;
    };
  }, [client.id, thenFrom, thenTo, nowFrom, client.first_intake_responses, client.intake_responses]);

  if (!thenTo || !nowFrom) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🔁 Then vs now</Text>
      <Text style={styles.helper}>
        Their first time with you ({thenFrom} to {thenTo}) against since they came back ({nowFrom}).
      </Text>
      {!rows ? (
        <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <Table heading="Training and habits" rows={rows.habits} empty="Nothing logged yet." />
          <Table heading="Best weights" rows={rows.lifts} empty="No lift done both times yet." />
          <Table heading="Intake form" rows={rows.intake} empty="Waiting for them to fill in the form again." />
        </>
      )}
    </View>
  );
}

function Table({ heading, rows, empty }: { heading: string; rows: CompareRow[]; empty: string }) {
  return (
    <View style={{ marginTop: 12 }}>
      <View style={styles.row}>
        <Text style={[styles.label, styles.heading]}>{heading}</Text>
        <Text style={[styles.cell, styles.heading]}>Then</Text>
        <Text style={[styles.cell, styles.heading]}>Now</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.helper}>{empty}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.cell}>{r.then}</Text>
            <Text style={[styles.cell, r.better === true && styles.better, r.better === false && styles.worse]}>
              {r.now}
              {r.better === true ? " ▲" : r.better === false ? " ▼" : ""}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111C33", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: BRAND_GOLD },
  title: { color: BRAND_GOLD, fontWeight: "700", fontSize: 16 },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  heading: { color: "#fff", fontWeight: "700" },
  label: { flex: 2, color: "#CBD5E1", fontSize: 13 },
  cell: { flex: 1, color: "#CBD5E1", fontSize: 13, textAlign: "right" },
  better: { color: "#22C55E", fontWeight: "700" },
  worse: { color: "#EF4444", fontWeight: "700" },
});
