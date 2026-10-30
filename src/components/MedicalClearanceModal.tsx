import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "./ModalSafeArea";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { CLEARANCE_OPTIONS, clearanceProblem, type ClearanceForm } from "@/lib/medicalHold";
import type { ClientProblem } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// The trainer clears a serious-symptoms hold (0133) only by confirming how it
// was resolved, who assessed it and when. The database checks it again.
export default function MedicalClearanceModal({
  problem,
  clientName,
  onClose,
  onCleared,
}: {
  problem: ClientProblem | null;
  clientName: string;
  onClose: () => void;
  onCleared: () => void;
}) {
  const blank = (): ClearanceForm => ({ clearance: null, by: "", on: todayIso(), checked: false });
  const [form, setForm] = useState<ClearanceForm>(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (problem) setForm(blank());
  }, [problem?.id]);
  if (!problem) return null;

  const set = (patch: Partial<ClearanceForm>) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    const missing = clearanceProblem(form, problem.reported_on, todayIso());
    if (missing) {
      Alert.alert("Not cleared yet", missing);
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("clear_medical_hold", {
      p_problem: problem.id,
      p_clearance: form.clearance!,
      p_cleared_by: form.by.trim(),
      p_cleared_on: form.on,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't clear the hold", error.message);
      return;
    }
    onCleared();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardSafe>
        <ModalSafeArea style={styles.container}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Clear {clientName}'s workout hold</Text>
            <Text style={styles.text}>They reported: {problem.detail || "serious symptoms"} ({problem.reported_on}).</Text>
            <Text style={styles.label}>How was it resolved?</Text>
            {CLEARANCE_OPTIONS.map((o) => (
              <Pressable key={o.key} style={[styles.option, form.clearance === o.key && styles.optionOn]} onPress={() => set({ clearance: o.key })}>
                <Text style={styles.optionText}>
                  {form.clearance === o.key ? "◉" : "○"} {o.label(clientName)}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.label}>{form.clearance === "reported_in_error" ? "Who confirmed it with you?" : "Who assessed them?"}</Text>
            <TextInput
              style={styles.input}
              value={form.by}
              onChangeText={(by) => set({ by })}
              placeholder={form.clearance === "reported_in_error" ? clientName : "e.g. Dr Naidoo (GP)"}
              placeholderTextColor="#64748B"
            />
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.on} onChangeText={(on) => set({ on: on.trim() })} placeholderTextColor="#64748B" />
            <Pressable style={styles.option} onPress={() => set({ checked: !form.checked })}>
              <Text style={styles.optionText}>
                {form.checked ? "☑" : "☐"} I've confirmed this myself and {clientName} is safe to train.
              </Text>
            </Pressable>
            <Pressable style={styles.save} onPress={save} disabled={saving}>
              <Text style={styles.saveText}>{saving ? "Saving..." : "Clear the hold"}</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Not yet</Text>
            </Pressable>
          </ScrollView>
        </ModalSafeArea>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  title: { color: "#FCA5A5", fontSize: 22, fontWeight: "900" },
  text: { color: "#E2E8F0", fontSize: 15, marginTop: 8 },
  label: { color: "#fff", fontWeight: "700", fontSize: 15, marginTop: 18, marginBottom: 6 },
  option: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#334155" },
  optionOn: { borderColor: "#22C55E" },
  optionText: { color: "#E2E8F0", fontSize: 15 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, fontSize: 16 },
  save: { backgroundColor: "#22C55E", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  cancel: { alignItems: "center", paddingVertical: 14 },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
});
