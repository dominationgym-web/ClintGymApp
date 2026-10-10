import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { RESET_HABITS, RESET_PHASES, RESET_WEEKS, RESET_WEEKS_TOTAL, newHabits, resetTraining, resetWeek, type ResetLocation } from "@/lib/resetProgram";

const PHASE_ORDER = ["calm", "rhythm", "build", "optimise"] as const;

// The whole 12 weeks on one screen: a small map of the four phases with a
// tile per week, and the chosen week's card underneath with Back and Next.
export default function WeekBrowser({
  week,
  onChange,
  currentWeek,
  location = null,
}: {
  week: number;
  onChange: (week: number) => void;
  // Her week if she has started, so it's highlighted and past weeks get a tick.
  currentWeek?: number;
  location?: ResetLocation | null;
}) {
  const plan = resetWeek(week);
  const phase = RESET_PHASES[plan.phase];
  const training = resetTraining(plan.phase, location);
  const fresh = new Set(newHabits(week));

  return (
    <View>
      <View style={styles.map}>
        {PHASE_ORDER.map((key) => {
          const p = RESET_PHASES[key];
          return (
            <View key={key} style={styles.mapRow}>
              <Text style={[styles.mapLabel, { color: p.color }]}>{p.name}</Text>
              <View style={styles.tiles}>
                {RESET_WEEKS.filter((w) => w.phase === key).map((w) => {
                  const selected = w.week === week;
                  const isCurrent = w.week === currentWeek;
                  const done = currentWeek !== undefined && w.week < currentWeek;
                  return (
                    <Pressable
                      key={w.week}
                      onPress={() => onChange(w.week)}
                      style={[
                        styles.tile,
                        { borderColor: p.color },
                        isCurrent && { backgroundColor: p.color },
                        selected && styles.tileSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Week ${w.week}`}
                    >
                      <Text style={[styles.tileText, isCurrent && styles.tileTextCurrent]}>{done ? "✓" : w.week}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.nav}>
        <Pressable
          style={[styles.navButton, week === 1 && styles.navDisabled]}
          disabled={week === 1}
          onPress={() => onChange(week - 1)}
        >
          <Text style={styles.navText}>‹ Back</Text>
        </Pressable>
        <Pressable
          style={[styles.navButton, styles.navNext, week === RESET_WEEKS_TOTAL && styles.navDisabled]}
          disabled={week === RESET_WEEKS_TOTAL}
          onPress={() => onChange(week + 1)}
        >
          <Text style={[styles.navText, styles.navNextText]}>Next week ›</Text>
        </Pressable>
      </View>
      <View style={[styles.card, { borderTopColor: phase.color }]}>
        <Text style={[styles.phase, { color: phase.color }]}>
          WEEK {plan.week} OF {RESET_WEEKS_TOTAL} · {phase.name}
          {plan.week === currentWeek ? " · THIS WEEK" : ""}
        </Text>
        <Text style={styles.title}>{plan.title}</Text>
        <Text style={styles.focus}>{plan.focus}</Text>

        <Text style={styles.label}>This week you'll</Text>
        {plan.todo.map((t) => (
          <Text key={t} style={styles.todo}>
            •  {t}
          </Text>
        ))}

        <Text style={styles.label}>Daily ticks</Text>
        <View style={styles.chips}>
          {RESET_HABITS.filter((h) => plan.habits.includes(h.key)).map((h) => (
            <Text key={h.key} style={[styles.chip, fresh.has(h.key) && styles.chipNew]}>
              {fresh.has(h.key) ? "NEW · " : ""}
              {h.label}
            </Text>
          ))}
        </View>

        <Text style={styles.training}>{location === "home" ? "🏠" : "🏋️"} {training.summary}{location === "home" ? " at home" : ""}</Text>
        <Text style={styles.tip}>💡 {plan.tip}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: "#1E293B", borderRadius: 12, padding: 10, gap: 6, marginBottom: 10 },
  mapRow: { flexDirection: "row", alignItems: "center" },
  mapLabel: { width: 82, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5 },
  tiles: { flexDirection: "row", gap: 8, flex: 1 },
  tile: { width: 34, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  tileSelected: { borderWidth: 3, borderColor: "#fff" },
  tileText: { color: "#E2E8F0", fontWeight: "700", fontSize: 13 },
  tileTextCurrent: { color: "#0F172A" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, borderTopWidth: 4 },
  phase: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5, marginBottom: 6 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  focus: { color: "#CBD5E1", fontSize: 14, lineHeight: 20 },
  label: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  todo: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginBottom: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    color: "#CBD5E1",
    fontSize: 12,
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  chipNew: { color: "#0F172A", backgroundColor: BRAND_GOLD, fontWeight: "700" },
  training: { color: "#E2E8F0", fontSize: 13.5, marginTop: 12 },
  tip: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginTop: 8, fontStyle: "italic" },
  nav: { flexDirection: "row", gap: 10, marginBottom: 12 },
  navButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: "#1E293B" },
  navNext: { backgroundColor: BRAND_GOLD },
  navDisabled: { opacity: 0.35 },
  navText: { color: "#E2E8F0", fontWeight: "700", fontSize: 15 },
  navNextText: { color: "#0F172A" },
});
