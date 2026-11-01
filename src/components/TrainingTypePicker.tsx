import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";

// How the trainer works with a client (GRIZZ, 2026-11-01): 1 on 1 (in-person
// sessions), Evolution (online coaching) or both. Stored as clients.live_only
// (1 on 1 only) and clients.one_on_one (on the 1 on 1 side), 0169/0176.
export type TrainingType = "one" | "evolution" | "both";

export const TRAINING_TYPES: { key: TrainingType; label: string; detail: string }[] = [
  {
    key: "one",
    label: "🤝 1 on 1",
    detail: "Live sessions with you. They get nutrition, meal plans, progress and an optional check-in. No programs or habits.",
  },
  { key: "evolution", label: "🌐 Evolution", detail: "Online coaching: programs, daily check-ins, habits and reminders." },
  { key: "both", label: "🤝🌐 Both", detail: "Live sessions with you plus the full online app." },
];

export function trainingTypeOf(c: { live_only?: boolean; one_on_one?: boolean }): TrainingType {
  if (c.live_only) return "one";
  return c.one_on_one ? "both" : "evolution";
}

export function trainingTypeFields(t: TrainingType): { live_only: boolean; one_on_one: boolean } {
  return { live_only: t === "one", one_on_one: t !== "evolution" };
}

export function trainingTypeLabel(t: TrainingType): string {
  return TRAINING_TYPES.find((x) => x.key === t)!.label;
}

// The three choices as rows. Used in the activate pop-up and in Plan & payment.
export function TrainingTypeRows({ value, onPick }: { value: TrainingType | null; onPick: (t: TrainingType) => void }) {
  return (
    <>
      {TRAINING_TYPES.map((t) => {
        const on = value === t.key;
        return (
          <Pressable
            key={t.key}
            style={[styles.option, on && styles.optionOn]}
            onPress={() => onPick(t.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.optionTitle, on && styles.optionTitleOn]}>{t.label}</Text>
            <Text style={styles.optionDetail}>{t.detail}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

export default function TrainingTypePicker({
  visible,
  name,
  message,
  onPick,
  onCancel,
}: {
  visible: boolean;
  name: string;
  message?: string;
  onPick: (t: TrainingType) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Text style={styles.title}>How will you train {name.split(" ")[0]}?</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TrainingTypeRows value={null} onPick={onPick} />
          <Text style={styles.message}>You can change this later under Plan & payment.</Text>
          <Pressable onPress={onCancel} style={styles.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#1E293B", borderRadius: 16, padding: 18, width: "100%", maxWidth: 380 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  message: { color: "#94A3B8", fontSize: 13, marginTop: 8 },
  option: { borderWidth: 1.5, borderColor: "#334155", borderRadius: 12, padding: 12, marginTop: 10 },
  optionOn: { borderColor: BRAND_GOLD },
  optionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  optionTitleOn: { color: BRAND_GOLD },
  optionDetail: { color: "#94A3B8", fontSize: 12, marginTop: 3 },
  cancel: { alignSelf: "center", marginTop: 14 },
  cancelText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
