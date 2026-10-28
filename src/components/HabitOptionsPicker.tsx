import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { findHabit, HABIT_GROUPS, isRunning } from "@/lib/habitLibrary";
import type { Habit } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// The trainer's habit options when adding a habit for a client (GRIZZ,
// 2026-10-14): the same list clients choose from, under tap-to-open headings.
// Tapping a habit fills in its name and times a day; the trainer can still
// change them, set the dates, or type their own habit instead.
// The picked habit is highlighted with an Add button right under it, and the
// client's habits stay marked in the list (Added, or Used before once stopped)
// so the trainer can see which have been used (GRIZZ, 2026-10-18).
export default function HabitOptionsPicker({
  habits,
  selected,
  onPick,
  onAdd,
  adding = false,
}: {
  habits: Habit[];
  selected: string;
  onPick: (name: string, reps: number) => void;
  onAdd?: () => void;
  adding?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const statusOf = (name: string): "added" | "used" | null => {
    const h = findHabit(habits, name);
    if (!h) return null;
    return isRunning(h, today) ? "added" : "used";
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>Pick from the list</Text>
      {HABIT_GROUPS.map((g) => {
        const isOpen = open === g.key;
        const addedCount = g.habits.filter((h) => statusOf(h.name) === "added").length;
        return (
          <View key={g.key} style={[styles.group, isOpen && styles.groupOpen]}>
            <Pressable style={styles.groupHeader} onPress={() => setOpen(isOpen ? null : g.key)}>
              <Text style={styles.groupIcon}>{g.icon}</Text>
              <Text style={styles.groupTitle}>{g.title}</Text>
              {addedCount > 0 && <Text style={styles.addedCount}>{addedCount} added</Text>}
              <Text style={styles.count}>{g.habits.length}</Text>
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen &&
              g.habits.map((h) => {
                const status = statusOf(h.name);
                const already = status === "added";
                const picked = !already && selected.trim().toLowerCase() === h.name.toLowerCase();
                return (
                  <View key={h.name}>
                    <Pressable
                      style={[styles.choice, already && styles.choiceAdded, picked && styles.choicePicked]}
                      onPress={() => !already && onPick(h.name, h.reps)}
                      disabled={already}
                    >
                      <View style={[styles.tick, already && styles.tickAdded, picked && styles.tickPicked]}>
                        {(already || picked) && <Text style={styles.tickMark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {h.name}
                          {h.reps > 1 ? ` (${h.reps}x a day)` : ""}
                        </Text>
                        <Text style={styles.why}>{h.why}</Text>
                      </View>
                      {already ? (
                        <Text style={[styles.badge, styles.badgeAdded]}>Added</Text>
                      ) : picked ? (
                        <Text style={[styles.badge, styles.badgePicked]}>Selected</Text>
                      ) : status === "used" ? (
                        <Text style={[styles.badge, styles.badgeUsed]}>Used before</Text>
                      ) : (
                        <Text style={styles.pick}>Pick</Text>
                      )}
                    </Pressable>
                    {picked && onAdd && (
                      <Pressable style={styles.addButton} onPress={onAdd} disabled={adding}>
                        {adding ? (
                          <ActivityIndicator color={themeText("#0F172A")} />
                        ) : (
                          <Text style={styles.addButtonText}>Add "{h.name}" for this client</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
          </View>
        );
      })}
      <Text style={[styles.label, { marginTop: 12 }]}>Or type your own</Text>
    </View>
  );
}

const styles = themedStyles({
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "700", marginBottom: 6 },
  group: { backgroundColor: "#0F172A", borderRadius: 10, marginBottom: 6, padding: 2, borderWidth: 1, borderColor: "transparent" },
  groupOpen: { borderColor: BRAND_GOLD },
  groupHeader: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  groupIcon: { fontSize: 18 },
  groupTitle: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  count: { color: "#64748B", fontSize: 13 },
  addedCount: { color: "#22C55E", fontSize: 12, fontWeight: "700" },
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
  choiceAdded: { backgroundColor: "#14281F", borderColor: "#22C55E" },
  choicePicked: { backgroundColor: "#3A3215", borderColor: BRAND_GOLD },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  tickAdded: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  tickPicked: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  tickMark: { color: "#0F172A", fontWeight: "900", fontSize: 13 },
  badge: { fontWeight: "800", fontSize: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  badgeAdded: { color: "#0F172A", backgroundColor: "#22C55E" },
  badgePicked: { color: "#0F172A", backgroundColor: BRAND_GOLD },
  badgeUsed: { color: "#FBBF24", borderWidth: 1, borderColor: "#FBBF24" },
  addButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 6, marginBottom: 8 },
  addButtonText: { color: "#0F172A", fontWeight: "800", fontSize: 14 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  why: { color: "#64748B", fontSize: 12, marginTop: 2 },
  pick: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13 },
});
