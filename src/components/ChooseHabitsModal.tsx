import React, { useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { findHabit, HABIT_GROUPS, isRunning } from "@/lib/habitLibrary";
import type { Habit } from "@/types/database";
import KeyboardSafe from "@/components/KeyboardSafe";

// The client picks habits to work on: suggested ones under tap-to-open
// headings, or one they type themselves.
export default function ChooseHabitsModal({
  visible,
  habits,
  onAdd,
  onClose,
}: {
  visible: boolean;
  habits: Habit[];
  onAdd: (name: string, reps: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ownName, setOwnName] = useState("");
  const [ownReps, setOwnReps] = useState(1);
  const today = todayIso();
  const added = (name: string) => {
    const h = findHabit(habits, name);
    return !!h && isRunning(h, today);
  };

  const add = async (name: string, reps: number) => {
    setBusy(name);
    const ok = await onAdd(name, reps);
    setBusy(null);
    return ok;
  };

  const addOwn = async () => {
    const name = ownName.trim();
    if (!name) return;
    Keyboard.dismiss();
    if (await add(name, ownReps)) {
      setOwnName("");
      setOwnReps(1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardSafe>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose habits to work on</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.helper}>Start with 2 or 3. Once they're easy, add another.</Text>
          <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
            {HABIT_GROUPS.map((g) => {
              const isOpen = open === g.key;
              return (
                <View key={g.key} style={[styles.group, isOpen && styles.groupOpen]}>
                  <Pressable style={styles.groupHeader} onPress={() => setOpen(isOpen ? null : g.key)}>
                    <Text style={styles.groupIcon}>{g.icon}</Text>
                    <Text style={styles.groupTitle}>{g.title}</Text>
                    <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
                  </Pressable>
                  {isOpen &&
                    g.habits.map((h) => {
                      const isAdded = added(h.name);
                      return (
                        <Pressable
                          key={h.name}
                          style={[styles.choice, isAdded && { borderColor: BRAND_GOLD }]}
                          onPress={() => !isAdded && add(h.name, h.reps)}
                          disabled={isAdded || busy !== null}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>
                              {h.name}
                              {h.reps > 1 ? ` (${h.reps}x a day)` : ""}
                            </Text>
                            <Text style={styles.helper}>{h.why}</Text>
                          </View>
                          <Text style={styles.addText}>{isAdded ? "Added ✓" : busy === h.name ? "…" : "+ Add"}</Text>
                        </Pressable>
                      );
                    })}
                </View>
              );
            })}

            <View style={[styles.group, open === "own" && styles.groupOpen]}>
              <Pressable style={styles.groupHeader} onPress={() => setOpen(open === "own" ? null : "own")}>
                <Text style={styles.groupIcon}>✏️</Text>
                <Text style={styles.groupTitle}>Your own habit</Text>
                <Text style={styles.chevron}>{open === "own" ? "▴" : "▾"}</Text>
              </Pressable>
              {open === "own" && (
                <View style={{ padding: 8, paddingTop: 0 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Pack my gym bag the night before"
                    placeholderTextColor="#64748B"
                    maxLength={60}
                    value={ownName}
                    onChangeText={setOwnName}
                    returnKeyType="done"
                    onSubmitEditing={addOwn}
                  />
                  <View style={styles.repsRow}>
                    <Text style={styles.helper}>Times a day</Text>
                    <Pressable style={styles.stepper} onPress={() => setOwnReps((n) => Math.max(1, n - 1))}>
                      <Text style={styles.stepperText}>-</Text>
                    </Pressable>
                    <Text style={styles.name}>{ownReps}</Text>
                    <Pressable style={styles.stepper} onPress={() => setOwnReps((n) => Math.min(10, n + 1))}>
                      <Text style={styles.stepperText}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    style={[styles.button, (!ownName.trim() || busy !== null) && { opacity: 0.5 }]}
                    onPress={addOwn}
                    disabled={!ownName.trim() || busy !== null}
                  >
                    <Text style={styles.buttonText}>Add my habit</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
          <Pressable style={[styles.button, { marginTop: 12 }]} onPress={onClose}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </View>
      </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.8)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#0F172A", borderRadius: 16, padding: 16, maxHeight: "90%", borderWidth: 1, borderColor: "#1E293B" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 8 },
  title: { color: "#fff", fontWeight: "800", fontSize: 17, flex: 1 },
  close: { color: "#94A3B8", fontSize: 20, fontWeight: "700" },
  helper: { color: "#64748B", fontSize: 13, marginTop: 2 },
  group: { backgroundColor: "#1E293B", borderRadius: 12, marginTop: 8, padding: 4 },
  groupOpen: { borderWidth: 1, borderColor: BRAND_GOLD },
  groupHeader: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  groupIcon: { fontSize: 20 },
  groupTitle: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 10,
    margin: 6,
    marginTop: 0,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  addText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14 },
  repsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10 },
  stepper: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  stepperText: { color: BRAND_GOLD, fontSize: 18, fontWeight: "700" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
});
