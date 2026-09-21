import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { ClientStatusFlag } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

const FLAGS: { key: ClientStatusFlag; label: string; color: string }[] = [
  { key: "red", label: "Urgent - I need guidance", color: "#EF4444" },
  { key: "orange", label: "I'd like some feedback", color: "#F59E0B" },
  { key: "green", label: "All good, no feedback needed", color: "#22C55E" },
];

export default function ClientProfileScreen() {
  const { client, signOut, refreshProfile } = useAuth();
  const [selectedFlag, setSelectedFlag] = useState<ClientStatusFlag | null>(null);
  // null means "not edited on this screen yet", so the box falls back to
  // whatever note is already on the row. That way the client can see and edit a
  // note they raised earlier instead of it silently riding along behind an empty
  // box, and what they read in the box is exactly what gets saved.
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!client) return null;

  const activeFlag = selectedFlag ?? client.status_flag;
  const noteValue = note ?? client.status_flag_note ?? "";
  const savedNote = client.status_flag_note ?? "";

  const handleSave = async () => {
    if (activeFlag !== "green" && !noteValue.trim()) {
      Alert.alert("Add a quick note", "Let your trainer know what's going on so they have context.");
      return;
    }
    setSaving(true);
    // status_flag_updated_at is stamped server-side by the trigger in 0023 -
    // the phone's clock is not trustworthy enough for the trainer to sort by.
    const { error } = await supabase
      .from("clients")
      .update({
        status_flag: activeFlag,
        status_flag_note: activeFlag === "green" ? null : noteValue.trim(),
      })
      .eq("id", client.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setSelectedFlag(null);
    setNote(null);
    await refreshProfile();
  };

  // Changing the flag counts, and so does adding detail to a flag that is
  // already standing - for the state that means "urgent", being unable to save
  // more context without first toggling the flag was the wrong constraint.
  const hasChange =
    (selectedFlag !== null && selectedFlag !== client.status_flag) ||
    (activeFlag !== "green" && noteValue.trim() !== savedNote);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{client.name}</Text>
      <Text style={styles.email}>{client.email}</Text>

      <View style={[styles.statusPill, statusStyle(client.access_status)]}>
        <Text style={styles.statusText}>{STATUS_LABEL[client.access_status]}</Text>
      </View>

      {client.plan_expires_at && (
        <Text style={styles.helper}>Plan renews/expires {new Date(client.plan_expires_at).toLocaleDateString()}</Text>
      )}

      <Text style={styles.sectionHeading}>How are you doing?</Text>
      <Text style={styles.body}>
        Let your trainer know if you need anything - they check this before anything else.
      </Text>
      {FLAGS.map((f) =>
        f.key === "red" ? (
          <Pressable key={f.key} style={styles.flagRow} onPress={() => setSelectedFlag(f.key)}>
            <Text style={styles.flagIcon}>🚩</Text>
            <View style={[styles.radio, activeFlag === f.key && { borderColor: f.color, backgroundColor: f.color }]} />
            <Text style={styles.flagLabel}>{f.label}</Text>
          </Pressable>
        ) : (
          <Pressable key={f.key} style={styles.flagRow} onPress={() => setSelectedFlag(f.key)}>
            <View style={[styles.flagDot, { backgroundColor: f.color }]} />
            <View style={[styles.radio, activeFlag === f.key && { borderColor: f.color, backgroundColor: f.color }]} />
            <Text style={styles.flagLabel}>{f.label}</Text>
          </Pressable>
        )
      )}

      {activeFlag !== "green" && (
        <TextInput
          style={styles.noteInput}
          multiline
          placeholder="Quick note for your trainer (what's going on?)"
          placeholderTextColor="#64748B"
          value={noteValue}
          onChangeText={setNote}
        />
      )}

      {hasChange && (
        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Update status</Text>}
        </Pressable>
      )}

      <Text style={styles.sectionHeading}>Goals</Text>
      <Text style={styles.body}>{client.goals || "Not set yet - your trainer will add this."}</Text>

      <Text style={styles.sectionHeading}>Injuries / notes for your trainer</Text>
      <Text style={styles.body}>{client.injuries || "None on file."}</Text>

      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case "active":
      return { backgroundColor: "#22C55E" };
    case "expiring_soon":
      return { backgroundColor: "#F59E0B" };
    default:
      return { backgroundColor: "#EF4444" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  title: { fontSize: 26, fontWeight: "700", color: "#fff" },
  email: { color: "#94A3B8", marginBottom: 12 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 8 },
  statusText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  helper: { color: "#64748B", fontSize: 12, marginBottom: 16 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  flagRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  flagDot: { width: 10, height: 10, borderRadius: 5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#334155" },
  flagIcon: { fontSize: 14, width: 10, textAlign: "center" },
  flagLabel: { color: "#E2E8F0", fontSize: 14, flexShrink: 1 },
  noteInput: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 14,
  },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  logoutButton: {
    backgroundColor: "#334155",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: { color: "#0F172A", fontWeight: "700" },
});
