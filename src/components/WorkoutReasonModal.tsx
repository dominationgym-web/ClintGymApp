import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import { BRAND_GOLD } from "@/lib/brand";
import KeyboardSafe from "@/components/KeyboardSafe";
import { MISSED_REASONS, PARTIAL_REASONS } from "@/lib/workoutSessions";
import { themeText, themedStyles } from "@/lib/theme";

// Asked when a client finishes only part of a workout, or can't train (0076):
// their coach is told why.
export default function WorkoutReasonModal({
  kind,
  done,
  planned,
  saving,
  onCancel,
  onSend,
}: {
  kind: "partial" | "missed" | null;
  done: number;
  planned: number;
  saving: boolean;
  onCancel: () => void;
  onSend: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  useEffect(() => {
    setPicked(null);
    setText("");
  }, [kind]);
  if (!kind) return null;

  const reasons = kind === "partial" ? PARTIAL_REASONS : MISSED_REASONS;
  const reason = [picked, text.trim()].filter(Boolean).join(": ");

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{kind === "partial" ? "What stopped you finishing?" : "Why can't you train today?"}</Text>
            <Text style={styles.helper}>
              {kind === "partial"
                ? `You did ${done} of ${planned} sets. Your coach will see this and can adjust your training.`
                : "Your coach will see this and can adjust your training."}
            </Text>
            <View style={styles.chips}>
              {reasons.map((r) => (
                <Pressable key={r} style={[styles.chip, picked === r && styles.chipOn]} onPress={() => setPicked(picked === r ? null : r)}>
                  <Text style={[styles.chipText, picked === r && styles.chipTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              multiline
              maxLength={400}
              placeholder="Anything else your coach should know"
              placeholderTextColor="#64748B"
              value={text}
              onChangeText={setText}
            />
            <View style={styles.buttons}>
              <Pressable style={[styles.button, styles.cancel]} onPress={onCancel} disabled={saving}>
                <Text style={styles.cancelText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.send, !reason && styles.disabled]} onPress={() => onSend(reason)} disabled={!reason || saving}>
                {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.sendText}>Tell my coach</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { flexGrow: 0, backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 4, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#475569", borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontSize: 13 },
  chipTextOn: { color: "#0F172A", fontWeight: "700" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: "top", marginTop: 12 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 16 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  cancel: { backgroundColor: "#334155" },
  cancelText: { color: "#fff", fontWeight: "600" },
  send: { backgroundColor: BRAND_GOLD },
  sendText: { color: "#0F172A", fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
