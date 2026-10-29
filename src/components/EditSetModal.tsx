import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import { supabase } from "@/lib/supabase";
import { parseWeight } from "@/lib/weightInput";
import { EFFORT_OPTIONS, EFFORT_QUESTION } from "@/lib/progression";
import { BRAND_GOLD } from "@/lib/brand";
import type { SetEffort, WorkoutLog } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// GRIZZ 2026-10-29: logged a set wrong during a workout? Tap it to fix the
// weight, reps or reps left. The client changes their own sets ("update own",
// 0017) and the trainer the sets of a live session ("trainer corrects live", 0134).
// Render it inside the workout's own Modal so it opens on top of it.
export default function EditSetModal({
  set,
  onSaved,
  onClose,
}: {
  set: WorkoutLog | null;
  onSaved: (updated: WorkoutLog) => void;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [effort, setEffort] = useState<SetEffort | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!set) return;
    setWeight(set.weight_kg != null ? String(set.weight_kg) : "");
    setReps(String(set.reps));
    setEffort(set.effort);
  }, [set]);

  // Warm-up and gauge sets keep the effort they were saved with.
  const askEffort = !!set && !set.warm_up && !set.gauge;

  const save = async () => {
    if (!set) return;
    const repsNum = Number(reps);
    if (!reps || Number.isNaN(repsNum) || repsNum <= 0) {
      Alert.alert("Missing reps", "Enter how many reps you did.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("workout_logs")
      .update({ weight_kg: parseWeight(weight), reps: repsNum, effort: askEffort && effort ? effort : set.effort })
      .eq("id", set.id)
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      Alert.alert("Couldn't change the set", error?.message ?? "Please try again.");
      return;
    }
    onSaved(data);
    onClose();
  };

  return (
    <Modal visible={!!set} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.wrap}>
          {set && (
            <View style={styles.sheet}>
              <Text style={styles.title}>
                ✏️ Fix {set.warm_up ? "warm-up" : `set ${set.set_number}`} · {set.exercise_name}
              </Text>
              <View style={styles.inputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    placeholder="Bodyweight"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Reps</Text>
                  <TextInput style={styles.input} value={reps} onChangeText={setReps} keyboardType="number-pad" placeholderTextColor="#64748B" />
                </View>
              </View>
              {askEffort && (
                <>
                  <Text style={styles.label}>{EFFORT_QUESTION}</Text>
                  <View style={styles.chips}>
                    {EFFORT_OPTIONS.map((o) => (
                      <Pressable key={o.key} style={[styles.chip, effort === o.key && styles.chipOn]} onPress={() => setEffort(o.key)}>
                        <Text style={[styles.chipText, effort === o.key && styles.chipTextOn]}>{o.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Pressable style={styles.save} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.saveText}>Save the change</Text>}
              </Pressable>
              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  wrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 2, borderColor: BRAND_GOLD, padding: 16, paddingBottom: 28 },
  title: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  inputs: { flexDirection: "row", gap: 10 },
  label: { color: "#E2E8F0", fontWeight: "700", marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 12, fontSize: 16 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: "#334155", paddingVertical: 10, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 12.5 },
  chipTextOn: { color: "#0F172A" },
  save: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
});
