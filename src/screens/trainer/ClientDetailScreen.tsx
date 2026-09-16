import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import type { Checkin, Client } from "@/types/database";
import type { TrainerStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<TrainerStackParamList, "ClientDetail">;

function formatIntakeLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClientDetailScreen({ route }: Props) {
  const { clientId } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: clientRow }, { data: checkinRows }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase
          .from("checkins")
          .select("*")
          .eq("client_id", clientId)
          .order("checkin_date", { ascending: false })
          .limit(14),
      ]);
      if (clientRow) {
        setClient(clientRow);
        setNotes(clientRow.trainer_notes ?? "");
      }
      setCheckins(checkinRows ?? []);
      setLoading(false);
    };
    load();
  }, [clientId]);

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({ trainer_notes: notes }).eq("id", clientId);
    setSaving(false);
    if (error) Alert.alert("Couldn't save notes", error.message);
  };

  if (loading || !client) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{client.name}</Text>
      <Text style={styles.helper}>{client.email}</Text>
      {client.injuries && <Text style={styles.body}>Injuries: {client.injuries}</Text>}
      {client.goals && <Text style={styles.body}>Goals: {client.goals}</Text>}

      <Text style={styles.sectionHeading}>Intake form</Text>
      {Object.keys(client.intake_responses ?? {}).length === 0 ? (
        <Text style={styles.helper}>No intake form completed yet.</Text>
      ) : (
        <View style={styles.intakeBox}>
          {Object.entries(client.intake_responses).map(([key, value]) => (
            <View key={key} style={styles.intakeRow}>
              <Text style={styles.intakeLabel}>{formatIntakeLabel(key)}</Text>
              <Text style={styles.intakeValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionHeading}>Trainer notes</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Private notes about this client"
        placeholderTextColor="#64748B"
      />
      <Pressable style={styles.button} onPress={saveNotes} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Save notes</Text>}
      </Pressable>

      <Text style={styles.sectionHeading}>Last 14 check-ins</Text>
      {checkins.length === 0 && <Text style={styles.helper}>No check-ins yet.</Text>}
      {checkins.map((c) => (
        <View key={c.id} style={[styles.checkinRow, c.distress_flag && styles.checkinDistress]}>
          <Text style={styles.checkinDate}>{c.checkin_date}</Text>
          {c.distress_flag && <Text style={styles.distressText}>⚠ {c.distress_notes}</Text>}
          <Text style={styles.checkinDetail}>
            Sleep {c.sleep_quality ?? "-"}/5 · Water {c.water_litres}L · Alcohol {c.alcohol_units}u · High-GI{" "}
            {c.high_gi_count}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  body: { color: "#E2E8F0", fontSize: 14, marginBottom: 4 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 20, marginBottom: 8 },
  intakeBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12 },
  intakeRow: { marginBottom: 10 },
  intakeLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 2 },
  intakeValue: { color: "#E2E8F0", fontSize: 14 },
  notesInput: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "700" },
  checkinRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  checkinDistress: { borderWidth: 1.5, borderColor: "#EF4444" },
  checkinDate: { color: "#fff", fontWeight: "600" },
  distressText: { color: "#F87171", fontSize: 13, marginTop: 4, fontWeight: "600" },
  checkinDetail: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
});
