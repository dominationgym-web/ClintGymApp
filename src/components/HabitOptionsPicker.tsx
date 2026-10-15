import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { findHabit, HABIT_GROUPS, isRunning } from "@/lib/habitLibrary";
import type { Habit } from "@/types/database";

// The trainer's habit options when adding a habit for a client (GRIZZ,
// 2026-10-14): the same list clients choose from, under tap-to-open headings.
// Tapping a habit fills in its name and times a day; the trainer can still
// change them, set the dates, or type their own habit instead.
export default function HabitOptionsPicker({
  habits,
  selected,
  onPick,
}: {
  habits: Habit[];
  selected: string;
  onPick: (name: string, reps: number) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const running = (name: string) => {
    const h = findHabit(habits, name);
    return !!h && isRunning(h, today);
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>Pick from the list</Text>
      {HABIT_GROUPS.map((g) => {
        const isOpen = open === g.key;
        return (
          <View key={g.key} style={[styles.group, isOpen && styles.groupOpen]}>
            <Pressable style={styles.groupHeader} onPress={() => setOpen(isOpen ? null : g.key)}>
              <Text style={styles.groupIcon}>{g.icon}</Text>
              <Text style={styles.groupTitle}>{g.title}</Text>
              <Text style={styles.count}>{g.habits.length}</Text>
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen &&
              g.habits.map((h) => {
                const already = running(h.name);
                const picked = selected.trim().toLowerCase() === h.name.toLowerCase();
                return (
                  <Pressable
                    key={h.name}
                    style={[styles.choice, picked && { borderColor: BRAND_GOLD }]}
                    onPress={() => !already && onPick(h.name, h.reps)}
                    disabled={already}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, already && { color: "#64748B" }]}>
                        {h.name}
                        {h.reps > 1 ? ` (${h.reps}x a day)` : ""}
                      </Text>
                      <Text style={styles.why}>{h.why}</Text>
                    </View>
                    <Text style={styles.pick}>{already ? "Running" : picked ? "Picked ✓" : "Pick"}</Text>
                  </Pressable>
                );
              })}
          </View>
        );
      })}
      <Text style={[styles.label, { marginTop: 12 }]}>Or type your own</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "700", marginBottom: 6 },
  group: { backgroundColor: "#0F172A", borderRadius: 10, marginBottom: 6, padding: 2, borderWidth: 1, borderColor: "transparent" },
  groupOpen: { borderColor: BRAND_GOLD },
  groupHeader: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  groupIcon: { fontSize: 18 },
  groupTitle: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  count: { color: "#64748B", fontSize: 13 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 10,
    margin: 6,
    marginTop: 0,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  why: { color: "#64748B", fontSize: 12, marginTop: 2 },
  pick: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13 },
});
