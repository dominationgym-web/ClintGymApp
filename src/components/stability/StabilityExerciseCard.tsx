import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import StabilityHowTo from "@/components/stability/StabilityHowTo";
import { BRAND_GOLD } from "@/lib/brand";
import {
  assessExercise,
  setsFor,
  targetText,
  unitLabel,
  type StabilityDose,
  type StabilityExercise,
  type StabilityLogLite,
  type StabilityMode,
  type StabilitySide,
} from "@/lib/stability";
import { themeText, themedStyles } from "@/lib/theme";

export type StabilityEntry = { set_number: number; side: StabilitySide | null; value: number };

type Props = {
  exercise: StabilityExercise;
  dose: StabilityDose;
  mode: StabilityMode;
  videoUrl: string | null;
  logs: StabilityLogLite[];
  loggedToday: boolean;
  open: boolean;
  onToggle: () => void;
  onSave: (entries: StabilityEntry[]) => Promise<boolean>;
};

const box = (set: number, side: StabilitySide | null) => `${set}-${side ?? "both"}`;

// One stability exercise: tap to open its how-to, when to stop, load and
// progression, then log each set as seconds held or reps done before control
// was lost (left and right separately for one-sided moves). Holds have a
// stopwatch: Start, then Stop the moment you lose control, and the time goes
// into the next empty box.
export default function StabilityExerciseCard({ exercise, dose, mode, videoUrl, logs, loggedToday, open, onToggle, onSave }: Props) {
  const sets = setsFor(dose, mode);
  const sides: (StabilitySide | null)[] = exercise.sided ? ["left", "right"] : [null];
  const order = Array.from({ length: sets }, (_, i) => i + 1).flatMap((s) => sides.map((side) => box(s, side)));
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const assessment = assessExercise(logs, dose, exercise);

  useEffect(() => {
    if (startedAt === null) return;
    timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [startedAt]);

  // Closing the card stops a running clock.
  useEffect(() => {
    if (!open) setStartedAt(null);
  }, [open]);

  const stopClock = () => {
    if (startedAt === null) return;
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    setStartedAt(null);
    const next = order.find((k) => !values[k]);
    if (next) setValues((v) => ({ ...v, [next]: String(secs) }));
  };

  const save = async () => {
    const entries: StabilityEntry[] = [];
    for (let s = 1; s <= sets; s++) {
      for (const side of sides) {
        const n = parseInt(values[box(s, side)] ?? "", 10);
        if (!Number.isNaN(n) && n >= 0) entries.push({ set_number: s, side, value: Math.min(n, exercise.measure === "hold" ? 3600 : 500) });
      }
    }
    if (entries.length === 0) return;
    setSaving(true);
    const ok = await onSave(entries);
    setSaving(false);
    if (ok) setValues({});
  };

  const badge =
    assessment.status === "ready"
      ? { text: "⬆ Ready to make it harder", colour: "#22C55E" }
      : assessment.status === "easier"
        ? { text: "⬇ Try the easier version", colour: "#F59E0B" }
        : null;

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {dose.primer ? "⚡ " : ""}
            {exercise.name}
          </Text>
          <Text style={styles.target}>
            {exercise.measure === "hold" ? "Hold " : ""}
            {targetText(dose, exercise, mode)}
          </Text>
          {badge && <Text style={[styles.badge, { color: themeText(badge.colour) }]}>{badge.text}</Text>}
        </View>
        {loggedToday && <Text style={styles.done}>✓</Text>}
        <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      {open && (
        <View style={styles.body}>
          <StabilityHowTo exercise={exercise} videoUrl={videoUrl} />

          <View style={styles.logBox}>
            <Text style={styles.logTitle}>
              Log {exercise.measure === "hold" ? "seconds held" : "reps"} before you lost control
            </Text>
            {assessment.last && (
              <Text style={styles.history}>
                Last time: {assessment.last}
                {exercise.measure === "hold" ? " sec" : ""}
                {assessment.best !== null ? `   ·   Best: ${unitLabel(exercise, assessment.best)}` : ""}
              </Text>
            )}
            {exercise.measure === "hold" && (
              <Pressable
                style={[styles.clock, startedAt !== null && styles.clockRunning]}
                onPress={() => (startedAt === null ? (setElapsed(0), setStartedAt(Date.now())) : stopClock())}
              >
                <Text style={styles.clockText}>
                  {startedAt === null ? "⏱ Start the clock" : `⏹ Stop: lost control   ${elapsed} sec`}
                </Text>
              </Pressable>
            )}
            {Array.from({ length: sets }, (_, i) => i + 1).map((s) => (
              <View key={s} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {s}</Text>
                {sides.map((side) => (
                  <View key={side ?? "both"} style={styles.inputWrap}>
                    {side && <Text style={styles.side}>{side === "left" ? "Left" : "Right"}</Text>}
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      placeholder={String(dose.target)}
                      placeholderTextColor="#475569"
                      value={values[box(s, side)] ?? ""}
                      onChangeText={(t) => setValues((v) => ({ ...v, [box(s, side)]: t.replace(/[^0-9]/g, "") }))}
                      maxLength={4}
                    />
                    <Text style={styles.unit}>{exercise.measure === "hold" ? "sec" : "reps"}</Text>
                  </View>
                ))}
              </View>
            ))}
            <Pressable style={styles.save} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: 12 },
  name: { color: "#fff", fontSize: 16, fontWeight: "700" },
  target: { color: BRAND_GOLD, fontSize: 13.5, marginTop: 2 },
  badge: { fontSize: 12.5, fontWeight: "700", marginTop: 4 },
  done: { color: "#22C55E", fontSize: 18, fontWeight: "800", marginRight: 10 },
  arrow: { color: BRAND_GOLD, fontSize: 13 },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  logBox: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 14 },
  logTitle: { color: "#fff", fontSize: 14.5, fontWeight: "700", marginBottom: 4 },
  history: { color: "#94A3B8", fontSize: 12.5, marginBottom: 6 },
  clock: { backgroundColor: "#334155", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginVertical: 6 },
  clockRunning: { backgroundColor: "#B91C1C" },
  clockText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  setRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  setLabel: { color: "#CBD5E1", fontSize: 13.5, width: 48 },
  inputWrap: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 4 },
  side: { color: "#94A3B8", fontSize: 12, marginRight: 4 },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 15,
    minWidth: 52,
    textAlign: "center",
  },
  unit: { color: "#64748B", fontSize: 12, marginLeft: 4 },
  save: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 12 },
  saveText: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
});
