import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { ENERGY_COLOR, ruleSummary, type WeekFacts } from "@/lib/clientSummary";
import { loadDailySummary, loadWeekFacts, type SummaryResult } from "@/lib/clientSummaryQueries";

// The trainer's daily summary of a client's energy and needs (0114, GRIZZ,
// 2026-10-18), from their last 7 days of check-ins, "How are you doing?"
// answers, training and outside exercise. Shown first on the client Overview.
// The app's own reading shows straight away; Claude's written version
// replaces it once it's back (saved for the day, so it's only written again
// when something new is logged).
export default function ClientDailySummaryCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const today = todayIso();
  const [facts, setFacts] = useState<WeekFacts | null>(null);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(
    async (force = false) => {
      const f = await loadWeekFacts(clientId, today);
      setFacts(f);
      setResult((r) => (r && !force ? r : { summary: ruleSummary(f), byAi: false, at: null }));
      setWriting(true);
      const ai = await loadDailySummary(clientId, today, f, force);
      setResult(ai);
      setWriting(false);
    },
    [clientId, today],
  );

  useEffect(() => {
    setFacts(null);
    setResult(null);
    load().catch(() => setWriting(false));
  }, [load]);

  const weekday = new Date(`${today}T12:00:00`).getDay();
  const endOfWeek = weekday === 5 || weekday === 6 || weekday === 0;
  const firstName = clientName.trim().split(/\s+/)[0] || "Client";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🧠 {endOfWeek ? "End of week summary" : "Daily summary"}</Text>
        {result && (
          <View style={[styles.energy, { borderColor: ENERGY_COLOR[result.summary.energy] ?? "#94A3B8" }]}>
            <Text style={[styles.energyText, { color: ENERGY_COLOR[result.summary.energy] ?? "#94A3B8" }]}>
              Energy: {result.summary.energy}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.helper}>{firstName}'s last 7 days, to help you plan their training.</Text>
      {!result || !facts ? (
        <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <Text style={styles.stats}>
            Check-ins {facts.checkinDays}/7 · Workouts {facts.workoutsDone + facts.workoutsPartial}
            {facts.workoutsPlanned ? `/${facts.workoutsPlanned}` : ""}
            {facts.otherActivities.length ? ` · Other exercise ${facts.otherActivities.length}` : ""}
            {facts.sleepHours !== null ? ` · Sleep ${facts.sleepHours}h` : ""}
          </Text>
          <Text style={styles.summary}>{result.summary.summary}</Text>
          {result.summary.suggestions.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.subTitle}>Suggestions</Text>
              {result.summary.suggestions.map((s) => (
                <Text key={s} style={styles.suggestion}>
                  • {s}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.footer}>
            <Text style={styles.source}>
              {writing
                ? "✨ AI is writing today's summary…"
                : result.byAi
                  ? `✨ Written by AI${result.at ? ` at ${new Date(result.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}. Check it against what you know.`
                  : result.noKey
                    ? "Worked out by the app's rules (the AI writer isn't switched on yet)."
                    : "Worked out by the app's rules."}
            </Text>
            {!writing && (
              <Pressable onPress={() => load(true).catch(() => setWriting(false))} hitSlop={8}>
                <Text style={styles.refresh}>↻ Refresh</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111C33", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: BRAND_GOLD },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  title: { color: BRAND_GOLD, fontWeight: "700", fontSize: 16 },
  energy: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  energyText: { fontWeight: "700", fontSize: 12 },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  stats: { color: "#CBD5E1", fontSize: 12, marginTop: 8 },
  summary: { color: "#fff", fontSize: 14, lineHeight: 20, marginTop: 8 },
  subTitle: { color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 2 },
  suggestion: { color: "#E2E8F0", fontSize: 13, lineHeight: 19, marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 },
  source: { color: "#94A3B8", fontSize: 11, flex: 1 },
  refresh: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
});
