import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import ModalSafeArea from "./ModalSafeArea";
import { useKeepAwake } from "expo-keep-awake";
import { BRAND_GOLD } from "@/lib/brand";
import { formatClock } from "@/lib/programs";
import { buildIntervals, EFFORT_GUIDE, totalMinutes, type IntervalPhase } from "@/lib/intervalTimer";
import { countdownCue } from "@/lib/timerWorkouts";
import { playTimerSound, prepareTimerSounds, setTimerSoundOn, switchSound } from "@/lib/timerSounds";
import type { ProgramExercise } from "@/types/database";

// Keeps the screen on while the timer runs.
function KeepAwake() {
  useKeepAwake();
  return null;
}

const WORK = "#DC2626";
const EASY = "#16A34A";
const READY = "#1E3A8A";

type Stage = "intro" | "running" | "done";

// The interval timer for timed workouts (sprints, threshold, fight
// conditioning). A "how to do it" card first, then every round counted out:
// WORK in red, EASY in green, a beep and a buzz at each switch, three knocks
// with 30 seconds left, a tick through the last 10 and a short beep for the
// last 3 (boxing rounds: a bell, and a clapper 10 seconds before the round ends). Open efforts (a 250 m row, a ladder) run until Done.
// At the end the finished efforts are saved as sets on the workout.
// The Timers page (EMOM, Tabata, intervals) passes its own `phases` instead:
// it starts straight away with a get ready count, says REST instead of EASY,
// and has nothing to save.
export default function IntervalTimerModal({
  visible,
  title,
  description,
  warmUp,
  rows,
  phases: ownPhases,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  description: string | null;
  warmUp: string | null;
  rows: ProgramExercise[];
  phases?: IntervalPhase[];
  // Finished efforts per row (seconds each, null for open ones), and cardio blocks done.
  onSave?: (efforts: { row: ProgramExercise; seconds: number | null }[], cardioIds: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const timerOnly = !!ownPhases;
  const phases = useMemo(() => ownPhases ?? buildIntervals(rows), [ownPhases, rows]);
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState<IntervalPhase[]>([]);
  const [saving, setSaving] = useState(false);
  const [sound, setSound] = useState(true);
  const lastBuzz = useRef<number | null>(null);

  const phase = phases[index] as IntervalPhase | undefined;

  const start = (i: number, done: IntervalPhase[]) => {
    if (i >= phases.length) {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      playTimerSound(phases[i - 1]?.bell ? "bellEnd" : "finish");
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
    if (i > 0) {
      Vibration.vibrate(p.kind === "work" ? [0, 600] : [0, 250, 150, 250]);
      playTimerSound(switchSound(p.kind, !!p.bell));
    }
  };

  const begin = () => {
    setStage("running");
    start(0, []);
  };

  useEffect(() => {
    if (!visible) return;
    prepareTimerSounds().then(setSound);
    setFinished([]);
    setPausedLeft(null);
    if (timerOnly) begin();
    else {
      setStage("intro");
      setIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
    if (lastBuzz.current === left || !phase) return;
    const cue = countdownCue(left, phase.seconds ?? 0, !!phase.bell && phase.kind === "work");
    if (!cue) return;
    lastBuzz.current = left;
    if (cue !== "ticker") Vibration.vibrate(80);
    playTimerSound(cue);
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
    if (!onSave) return;
    setSaving(true);
    const efforts = finished
      .filter((p) => p.countsAsSet)
      .map((p) => ({ row: rows.find((r) => r.id === p.rowId)!, seconds: p.seconds }))
      .filter((e) => e.row);
    const cardioIds = Array.from(new Set(finished.filter((p) => rows.find((r) => r.id === p.rowId)?.kind === "cardio").map((p) => p.rowId)));
    const saved = await onSave(efforts, cardioIds);
    setSaving(false);
    // On a failed save the timer stays open so the efforts aren't lost.
    if (saved) onClose();
  };

  const color = phase?.getReady ? READY : phase?.kind === "work" ? WORK : EASY;
  const upNext = phases[index + 1];
  const efforts = finished.filter((p) => (timerOnly ? p.kind === "work" : p.countsAsSet)).length;
  const easyWord = timerOnly ? "REST" : "EASY";
  const kicker = (p: IntervalPhase) => (p.getReady ? "GET READY" : `${p.kind === "work" ? "WORK" : easyWord} · ROUND ${p.round} OF ${p.rounds}`);
  // "rest, Rest" says it twice.
  const nextName = (p: IntervalPhase) => (p.kind === "easy" && p.name === "Rest" ? "" : `, ${p.name}`);
  const timeDone = finished.reduce((t, p) => t + (p.getReady ? 0 : p.seconds ?? 0), 0);
  const openElapsed = Math.floor((now - startedAt) / 1000);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={[styles.screen, stage === "running" && { backgroundColor: color }]}>
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
                Tap Start. The screen goes red for WORK and green for EASY, and the phone beeps and buzzes at every switch. Distance efforts run until you tap Done.
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
            <Pressable style={styles.startButton} onPress={begin}>
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          </ScrollView>
        )}

        {stage === "running" && phase && (
          <View style={styles.runPad}>
            <KeepAwake />
            <Text style={styles.runKicker}>{kicker(phase)}</Text>
            {!phase.getReady && phase.sets && phase.sets > 1 ? (
              <Text style={styles.runKicker}>
                TABATA {phase.set} OF {phase.sets}
              </Text>
            ) : null}
            <Text style={styles.runName}>{phase.name}</Text>
            {phase.detail ? <Text style={styles.runDetail}>{phase.detail}</Text> : null}
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
              {upNext ? `Next: ${upNext.kind === "work" ? "WORK" : easyWord.toLowerCase()}${nextName(upNext)}${upNext.seconds ? ` (${formatClock(upNext.seconds)})` : ""}` : "Last one!"}
            </Text>
            <View style={styles.controls}>
              {left !== null && (
                <Pressable style={styles.control} onPress={pause}>
                  <Text style={styles.controlText}>{pausedLeft !== null ? "Resume" : "Pause"}</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.control}
                onPress={() => {
                  setSound(!sound);
                  setTimerSoundOn(!sound);
                }}
                accessibilityLabel={sound ? "Turn sound off" : "Turn sound on"}
              >
                <Text style={styles.controlText}>{sound ? "🔊" : "🔇"}</Text>
              </Pressable>
              <Pressable style={styles.control} onPress={() => next(phase.kind === "easy")}>
                <Text style={styles.controlText}>Skip ›</Text>
              </Pressable>
              <Pressable style={styles.control} onPress={() => { setFinished(finished); setStage("done"); }}>
                <Text style={styles.controlText}>Stop</Text>
              </Pressable>
            </View>
          </View>
        )}

        {stage === "done" && timerOnly && (
          <View style={styles.pad}>
            <Text style={styles.kicker}>⏱ TIMER</Text>
            <Text style={styles.title}>{efforts > 0 ? "Great work! 💪" : "Timer stopped"}</Text>
            <Text style={styles.sub}>{title}</Text>
            {efforts > 0 ? (
              <Text style={[styles.stepText, { marginTop: 12 }]}>
                You finished {efforts} effort{efforts === 1 ? "" : "s"} in {formatClock(timeDone)}.
              </Text>
            ) : null}
            <Pressable style={styles.startButton} onPress={begin}>
              <Text style={styles.startText}>Go again</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
        )}

        {stage === "done" && !timerOnly && (
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
      </ModalSafeArea>
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
  runKicker: { color: "#fff", fontWeight: "800", letterSpacing: 2, fontSize: 16, opacity: 0.9, textAlign: "center" },
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
