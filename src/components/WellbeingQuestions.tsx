import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { splitKinds, toggleKind, WELLBEING_TOPICS, type WellbeingAnswer, type WellbeingForm, type WellbeingKey } from "@/lib/wellbeing";

// Pain, fatigue and mental exhaustion on the check-in (0055). Each needs a tap:
// "I'm okay", or "Something's up" with what it is and a short note.
export default function WellbeingQuestions({
  value,
  onChange,
}: {
  value: WellbeingForm;
  onChange: (next: WellbeingForm) => void;
}) {
  const update = (key: WellbeingKey, change: Partial<WellbeingAnswer>) =>
    onChange({ ...value, [key]: { ...value[key], ...change } });

  return (
    <View>
      <Text style={styles.heading}>Body and mind</Text>
      <Text style={styles.hint}>Your trainer uses this to adjust your program. Answer all three.</Text>
      {WELLBEING_TOPICS.map((t) => {
        const a = value[t.key];
        return (
          <View key={t.key} style={[styles.card, a.status === "reported" && styles.cardReported]}>
            <Text style={styles.title}>
              {t.icon} {t.title}
            </Text>
            <Text style={styles.question}>{t.question}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.choice, a.status === "ok" && styles.okOn]}
                onPress={() => update(t.key, { status: "ok" })}
              >
                <Text style={[styles.choiceText, a.status === "ok" && styles.choiceTextOn]}>✅ I'm okay</Text>
              </Pressable>
              <Pressable
                style={[styles.choice, a.status === "reported" && styles.reportOn]}
                onPress={() => update(t.key, { status: "reported" })}
              >
                <Text style={[styles.choiceText, a.status === "reported" && styles.choiceTextOn]}>⚠️ Something's up</Text>
              </Pressable>
            </View>
            {a.status === "reported" && (
              <View>
                <Text style={styles.label}>{t.key === "pain" ? `${t.kindLabel} Tap every place that hurts.` : t.kindLabel}</Text>
                <View style={styles.chips}>
                  {t.kinds.map((kind) => {
                    // Pain can be in more than one place (GRIZZ, 2026-10-17): tap several.
                    const picked = t.key === "pain" ? splitKinds(a.kind) : [a.kind];
                    const on = picked.includes(kind);
                    const next = t.key === "pain" ? toggleKind(a.kind, kind) : kind;
                    return (
                      <Pressable key={kind} style={[styles.chip, on && styles.chipOn]} onPress={() => update(t.key, { kind: next })}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{kind}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.label}>What is it and why?</Text>
                <TextInput
                  style={styles.input}
                  multiline
                  maxLength={1000}
                  placeholder={t.notesPlaceholder}
                  placeholderTextColor="#64748B"
                  value={a.notes}
                  onChangeText={(notes) => update(t.key, { notes })}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 4 },
  hint: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: "transparent" },
  cardReported: { borderColor: "#F59E0B" },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  question: { color: "#94A3B8", fontSize: 13, marginTop: 2, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  okOn: { backgroundColor: "#22C55E" },
  reportOn: { backgroundColor: "#F59E0B" },
  choiceText: { color: "#CBD5E1", fontWeight: "700", fontSize: 14 },
  choiceTextOn: { color: "#0F172A" },
  label: { color: "#94A3B8", fontWeight: "600", marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#0F172A" },
  chipOn: { backgroundColor: "#F59E0B" },
  chipText: { color: "#CBD5E1", fontSize: 13 },
  chipTextOn: { color: "#0F172A", fontWeight: "700" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: "top" },
});
