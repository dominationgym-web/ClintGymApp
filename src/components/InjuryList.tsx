import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { INJURY_AREAS } from "@/lib/injuryRisk";
import type { ClientInjury } from "@/types/database";

// Each injury a client has, as many as they need (GRIZZ, 2026-10-17): where
// it is and a short note. Ticked off once healed. The client keeps it up to
// date on their profile; the trainer sees and can add to it. Open injuries
// feed the injury check on the trainer's Training tab.
export default function InjuryList({
  clientId,
  role,
  clientName,
  onChanged,
}: {
  clientId: string;
  role: "client" | "trainer";
  clientName?: string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<ClientInjury[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHealed, setShowHealed] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("client_injuries").select("*").eq("client_id", clientId).order("created_at");
    setRows(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!area) return Alert.alert("Where is it?", "Pick the area of the injury.");
    setBusy(true);
    const { error } = await supabase.from("client_injuries").insert({ client_id: clientId, area, notes: notes.trim() || null });
    setBusy(false);
    if (error) return Alert.alert("Couldn't save", error.message);
    setAdding(false);
    setArea("");
    setNotes("");
    await load();
    onChanged?.();
  };

  const setHealed = async (row: ClientInjury, healed: boolean) => {
    const { error } = await supabase.from("client_injuries").update({ healed_on: healed ? todayIso() : null }).eq("id", row.id);
    if (error) return Alert.alert("Couldn't update", error.message);
    await load();
    onChanged?.();
  };

  const confirmHealed = (row: ClientInjury) =>
    Alert.alert(`${row.area} healed?`, role === "client" ? "Your coach will see it's better." : `It no longer counts in ${clientName}'s injury check.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes, healed", onPress: () => setHealed(row, true) },
    ]);

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 8 }} />;

  const open = rows.filter((r) => !r.healed_on);
  const healed = rows.filter((r) => r.healed_on);

  return (
    <View>
      {open.length === 0 && <Text style={styles.empty}>No injuries listed.</Text>}
      {open.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.area}>🩹 {r.area}</Text>
            {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
            <Text style={styles.since}>Since {r.created_at.slice(0, 10)}</Text>
          </View>
          <Pressable style={styles.healedBtn} onPress={() => confirmHealed(r)}>
            <Text style={styles.healedText}>✓ Healed</Text>
          </Pressable>
        </View>
      ))}
      {healed.length > 0 && (
        <Pressable onPress={() => setShowHealed((v) => !v)} hitSlop={6}>
          <Text style={styles.toggle}>
            {showHealed ? "Hide healed ▴" : `Healed (${healed.length}) ▾`}
          </Text>
        </Pressable>
      )}
      {showHealed &&
        healed.map((r) => (
          <View key={r.id} style={[styles.row, styles.rowHealed]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.area, { color: "#94A3B8" }]}>✓ {r.area}</Text>
              {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
              <Text style={styles.since}>Healed {r.healed_on}</Text>
            </View>
            <Pressable onPress={() => setHealed(r, false)} hitSlop={6}>
              <Text style={styles.back}>It's back</Text>
            </Pressable>
          </View>
        ))}
      {adding ? (
        <View style={styles.form}>
          <Text style={styles.label}>Where is it?</Text>
          <View style={styles.chips}>
            {INJURY_AREAS.map((a) => (
              <Pressable key={a} style={[styles.chip, area === a && styles.chipOn]} onPress={() => setArea(a)}>
                <Text style={[styles.chipText, area === a && styles.chipTextOn]}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>What is it? (optional)</Text>
          <TextInput
            style={styles.input}
            multiline
            maxLength={1000}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Torn ACL, left knee, 2024. Hurts going down stairs."
            placeholderTextColor="#64748B"
          />
          <View style={styles.formButtons}>
            <Pressable style={styles.cancel} onPress={() => setAdding(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={save} disabled={busy}>
              {busy ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Save injury</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.add} onPress={() => setAdding(true)}>
          <Text style={styles.addText}>＋ Add {open.length ? "another" : "an"} injury</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#94A3B8", fontSize: 14, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: "#7F1D1D" },
  rowHealed: { borderColor: "#1E293B" },
  area: { color: "#FCA5A5", fontWeight: "800", fontSize: 15 },
  notes: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  since: { color: "#64748B", fontSize: 11, marginTop: 2 },
  healedBtn: { borderWidth: 1, borderColor: "#22C55E", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  healedText: { color: "#22C55E", fontWeight: "800", fontSize: 12 },
  back: { color: "#F59E0B", fontWeight: "700", fontSize: 12 },
  toggle: { color: "#94A3B8", fontWeight: "700", marginTop: 10 },
  form: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 10 },
  label: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 6, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14, minHeight: 60, textAlignVertical: "top" },
  formButtons: { flexDirection: "row", gap: 8, marginTop: 10 },
  cancel: { flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
  save: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  saveText: { color: "#0F172A", fontWeight: "800" },
  add: { borderWidth: 1, borderColor: BRAND_GOLD, borderStyle: "dashed", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  addText: { color: BRAND_GOLD, fontWeight: "800" },
});
