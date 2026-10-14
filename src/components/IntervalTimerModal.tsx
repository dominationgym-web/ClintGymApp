import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { BRAND_GOLD } from "@/lib/brand";
import { formatClock } from "@/lib/programs";
import { buildIntervals, EFFORT_GUIDE, totalMinutes, type IntervalPhase } from "@/lib/intervalTimer";
import type { ProgramExercise } from "@/types/database";

// Keeps the screen on while the timer runs.
function KeepAwake() {
  useKeepAwake();
  return null;
}

const WORK = "#DC2626";
const EASY = "#16A34A";

type Stage = "intro" | "running" | "done";

// The interval timer for timed workouts (sprints, threshold, fight
// conditioning). A "how to do it" card first, then every round counted out:
// WORK in red, EASY in green, a buzz at each switch and a short buzz for the
// last 3 seconds. Open efforts (a 250 m row, a ladder) run until Done.
// At the end the finished efforts are saved as sets on the workout.
export default function IntervalTimerModal({
  visible,
  title,
  description,
  warmUp,
  rows,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  description: string | null;
  warmUp: string | null;
  rows: ProgramExercise[];
  // Finished efforts per row (seconds each, null for open ones), and cardio blocks done.
  onSave: (efforts: { row: ProgramExercise; seconds: number | null }[], cardioIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const phases = useMemo(() => buildIntervals(rows), [rows]);
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState<IntervalPhase[]>([]);
  const [saving, setSaving] = useState(false);
  const lastBuzz = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStage("intro");
    setIndex(0);
    setFinished([]);
    setPausedLeft(null);
  }, [visible]);

  const phase = phases[index] as IntervalPhase | undefined;

  const start = (i: number, done: IntervalPhase[]) => {
    if (i >= phases.length) {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      setFinished(done);
      setStage("done");
      return;
    }
    const p = phases[i];
    const t = Date.now();
    setIndex(i);
    setFinished(done);
    setStartedAt(t);
    setNow(t);
    setPausedLeft(null);
    setEndsAt(p.seconds ? t + p.seconds * 1000 : null);
    lastBuzz.current = null;
    if (i > 0) Vibration.vibrate(p.kind === "work" ? [0, 600] : [0, 250, 150, 250]);
  };

  const next = (completed: boolean) => {
    if (!phase) return;
    start(index + 1, completed ? [...finished, phase] : finished);
  };

  // Tick while running; move on when the phase runs out.
  useEffect(() => {
    if (stage !== "running" || pausedLeft !== null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [stage, pausedLeft]);

  const left = endsAt !== null ? Math.max(0, Math.ceil(((pausedLeft ?? endsAt - now) as number) / 1000)) : null;
  useEffect(() => {
    if (stage !== "running" || pausedLeft !== null || endsAt === null || left === null) return;
    if (left === 0) {
      next(true);
      return;
    }
    if (left <= 3 && lastBuzz.current !== left) {
      lastBuzz.current = left;
      Vibration.vibrate(80);
    }
  });

  const pause = () => {
    if (endsAt === null) return;
    if (pausedLeft === null) setPausedLeft(endsAt - Date.now());
    else {
      setEndsAt(Date.now() + pausedLeft);
      setNow(Date.now());
      setPausedLeft(null);
    }
  };

  const save = async () => {
    setSaving(true);
    const efforts = finished
      .filter((p) => p.countsAsSet)
      .map((p) => ({ row: rows.find((r) => r.id === p.rowId)!, seconds: p.seconds }))
      .filter((e) => e.row);
    const cardioIds = Array.from(new Set(finished.filter((p) => rows.find((r) => r.id === p.rowId)?.kind === "cardio").map((p) => p.rowId)));
    await onSave(efforts, cardioIds);
    setSaving(false);
    onClose();
  };

  const color = phase?.kind === "work" ? WORK : EASY;
  const upNext = phases[index + 1];
  const efforts = finished.filter((p) => p.countsAsSet).length;
  const openElapsed = Math.floor((now - startedAt) / 1000);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, stage === "running" && { backgroundColor: color }]}>
        {stage === "intro" && (
          <ScrollView contentContainerStyle={styles.pad}>
            <View style={styles.header}>
              <Text style={styles.kicker}>⏱ INTERVAL TIMER</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>
              {phases.filter((p) => p.kind === "work").length} efforts · about {totalMinutes(phases)} min
            </Text>
            <Text style={styles.label}>HOW TO DO IT</Text>
            <View style={styles.step}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>Warm up first. {warmUp ?? "5 minutes easy, building up."}</Text>
            </View>
            {description ? (
              <View style={styles.step}>
                <Text style={styles.stepNum}>2</Text>
                <Text style={styles.stepText}>{description}</Text>
              </View>
            ) : null}
            <View style={styles.step}>
              <Text style={styles.stepNum}>{description ? 3 : 2}</Text>
              <Text style={styles.stepText}>
                Tap Start. The screen goes red for WORK and green for EASY, and the phone buzzes at every switch. Distance efforts run until you tap Done.
              </Text>
            </View>
            <Text style={styles.label}>HOW HARD IS HARD?</Text>
            {EFFORT_GUIDE.map((g) => (
              <View key={g.label} style={styles.effort}>
                <Text style={styles.effortLabel}>{g.label}</Text>
                <Text style={styles.stepText}>{g.text}</Text>
              </View>
            ))}
            <Text style={styles.note}>The screen stays on while the timer runs.</Text>
            <Pressable style={styles.startButton} onPress={() => { setStage("running"); start(0, []); }}>
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          </ScrollView>
        )}

        {stage === "running" && phase && (
          <View style={styles.runPad}>
            <KeepAwake />
            <Text style={styles.runKicker}>
              {phase.kind === "work" ? "WORK" : "EASY"} · ROUND {phase.round} OF {phase.rounds}
            </Text>
            <Text style={styles.runName}>{phase.name}</Text>
            <Text style={styles.runDetail}>{phase.detail}</Text>
            {left !== null ? (
              <Text style={styles.clock}>{formatClock(left)}</Text>
            ) : (
              <>
                <Text style={styles.clock}>{formatClock(openElapsed)}</Text>
                <Pressable style={styles.doneButton} onPress={() => next(true)}>
                  <Text style={[styles.doneText, { color }]}>Done ✓</Text>
                </Pressable>
              </>
            )}
            {pausedLeft !== null && <Text style={styles.paused}>Paused</Text>}
            <Text style={styles.upNext}>
              {upNext ? `Next: ${upNext.kind === "work" ? "WORK" : "easy"}, ${upNext.name}${upNext.seconds ? ` (${formatClock(upNext.seconds)})` : ""}` : "Last one!"}
            </Text>
            <View style={styles.controls}>
              {left !== null && (
                <Pressable style={styles.control} onPress={pause}>
                  <Text style={styles.controlText}>{pausedLeft !== null ? "Resume" : "Pause"}</Text>
                </Pressable>
              )}
              <Pressable style={styles.control} onPress={() => next(phase.kind === "easy")}>
                <Text style={styles.controlText}>Skip ›</Text>
              </Pressable>
              <Pressable style={styles.control} onPress={() => { setFinished(finished); setStage("done"); }}>
                <Text style={styles.controlText}>Stop</Text>
              </Pressable>
            </View>
          </View>
        )}

        {stage === "done" && (
          <View style={styles.pad}>
            <Text style={styles.kicker}>⏱ INTERVAL TIMER</Text>
            <Text style={styles.title}>{efforts > 0 ? "Great work! 💪" : "Timer stopped"}</Text>
            <Text style={styles.stepText}>
              {efforts > 0
                ? `You finished ${efforts} effort${efforts === 1 ? "" : "s"}. Save them to today's workout so your coach can see them.`
                : "Nothing to save yet."}
            </Text>
            {efforts > 0 || finished.length > 0 ? (
              <Pressable style={styles.startButton} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.startText}>Save to my workout</Text>}
              </Pressable>
            ) : null}
            <Pressable style={styles.secondary} onPress={onClose}>
              <Text style={styles.close}>{efforts > 0 ? "Close without saving" : "Close"}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  pad: { padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: BRAND_GOLD, fontWeight: "800", letterSpacing: 1.5, fontSize: 12 },
  close: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 8 },
  sub: { color: "#94A3B8", fontSize: 14, marginTop: 4 },
  label: { color: BRAND_GOLD, fontWeight: "800", fontSize: 12, letterSpacing: 1.2, marginTop: 22, marginBottom: 8 },
  step: { flexDirection: "row", gap: 12, marginBottom: 10 },
  stepNum: { color: "#0F172A", backgroundColor: BRAND_GOLD, width: 24, height: 24, borderRadius: 12, textAlign: "center", fontWeight: "800", lineHeight: 24 },
  stepText: { color: "#E2E8F0", fontSize: 15, lineHeight: 21, flex: 1 },
  effort: { backgroundColor: "#1E293B", borderRadius: 10, padding: 10, marginBottom: 8 },
  effortLabel: { color: "#fff", fontWeight: "800", fontSize: 14, marginBottom: 2 },
  note: { color: "#94A3B8", fontSize: 13, marginTop: 10 },
  startButton: { backgroundColor: BRAND_GOLD, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  startText: { color: "#0F172A", fontWeight: "800", fontSize: 18 },
  secondary: { alignItems: "center", padding: 14 },
  runPad: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center" },
  runKicker: { color: "#fff", fontWeight: "800", letterSpacing: 2, fontSize: 16, opacity: 0.9 },
  runName: { color: "#fff", fontSize: 30, fontWeight: "800", textAlign: "center", marginTop: 10 },
  runDetail: { color: "#fff", fontSize: 17, textAlign: "center", marginTop: 6, opacity: 0.9 },
  clock: { color: "#fff", fontSize: 96, fontWeight: "800", marginVertical: 20, fontVariant: ["tabular-nums"] },
  paused: { color: "#fff", fontWeight: "800", fontSize: 18 },
  doneButton: { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, marginBottom: 12 },
  doneText: { fontWeight: "800", fontSize: 22 },
  upNext: { color: "#fff", fontSize: 15, textAlign: "center", marginTop: 8, opacity: 0.9 },
  controls: { flexDirection: "row", gap: 12, marginTop: 30 },
  control: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  controlText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
