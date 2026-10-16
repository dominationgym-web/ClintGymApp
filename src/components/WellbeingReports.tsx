import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import RehabSuggestion from "@/components/stability/RehabSuggestion";
import { reportsByTopic, WELLBEING_TOPICS, type WellbeingKey, type WellbeingReport } from "@/lib/wellbeing";

// On the trainer's Notes tab: what the client reported on their check-ins
// (0055), in three sections (Injury or pain, Fatigue, Mental exhaustion), so
// the trainer can adjust their program. Tap a section to open it.
export default function WellbeingReports({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [reports, setReports] = useState<Record<WellbeingKey, WellbeingReport[]> | null>(null);
  const [open, setOpen] = useState<WellbeingKey | null>(null);

  useEffect(() => {
    supabase
      .from("checkins")
      .select("*")
      .eq("client_id", clientId)
      .or("pain_status.eq.reported,fatigue_status.eq.reported,mental_status.eq.reported")
      .order("checkin_date", { ascending: false })
      .limit(60)
      .then(({ data }) => setReports(reportsByTopic(data ?? [])));
  }, [clientId]);

  if (!reports) return <ActivityIndicator color="#22C55E" style={{ marginVertical: 12 }} />;

  return (
    <View>
      <Text style={styles.heading}>Body and mind</Text>
      <Text style={styles.helper}>What the client reported on their check-ins.</Text>
      {WELLBEING_TOPICS.map((t) => {
        const list = reports[t.key];
        const isOpen = open === t.key;
        return (
          <View key={t.key} style={[styles.card, list.length > 0 && styles.cardFlagged]}>
            <Pressable style={styles.header} onPress={() => setOpen(isOpen ? null : t.key)}>
              <Text style={styles.icon}>{t.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.latest}>
                  {list.length === 0 ? "Nothing reported" : `Latest: ${list[0].date} · ${list[0].kind}`}
                </Text>
              </View>
              {list.length > 0 && <Text style={styles.count}>{list.length}</Text>}
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen &&
              (list.length === 0 ? (
                <Text style={styles.entryNotes}>Nothing reported yet.</Text>
              ) : (
                <>
                  {t.key === "pain" && <RehabSuggestion clientName={clientName} texts={[list[0].kind, list[0].notes]} />}
                  {list.slice(0, 10).map((r) => (
                    <View key={r.date} style={styles.entry}>
                      <Text style={styles.entryHead}>
                        {r.date} · {r.kind}
                      </Text>
                      <Text style={styles.entryNotes}>{r.notes}</Text>
                    </View>
                  ))}
                </>
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 16, marginBottom: 2 },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 6, marginBottom: 8, borderWidth: 1.5, borderColor: "transparent" },
  cardFlagged: { borderColor: "#F59E0B" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  icon: { fontSize: 22 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  latest: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  count: { color: "#F59E0B", fontWeight: "800", fontSize: 14 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  entry: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, margin: 6, marginTop: 0 },
  entryHead: { color: "#FBBF24", fontWeight: "700", fontSize: 13 },
  entryNotes: { color: "#E2E8F0", fontSize: 13, marginTop: 4, paddingHorizontal: 4 },
});
