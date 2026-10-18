import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { applyExerciseChanges } from "@/lib/exerciseChanges";
import { loadExerciseChanges, loadProgramExercises } from "@/lib/programQueries";
import { exercisesForSlot } from "@/lib/trainingCalendar";
import { exerciseRisks, injuryAreas, riskLine, type InjuryRisk } from "@/lib/injuryRisk";
import { findArea } from "@/lib/stability";
import type { StabilityArea } from "@/lib/stability";
import ExerciseChangeModal from "@/components/ExerciseChangeModal";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { ProgramExercise } from "@/types/database";

const RED = "#EF4444";
const GREEN = "#22C55E";

type Flagged = { row: ProgramExercise; risks: InjuryRisk[] };

// Injury check (GRIZZ, 2026-10-17), at the top of the client's Training tab.
// Takes the client's injuries (intake box and open pain reports), looks at
// every exercise in their plan from today on (calendar days and any main
// program), and lists the ones that could aggravate them. "Fix them" walks
// the trainer through each one in ExerciseChangeModal, which suggests 3 safe
// swaps and won't save a risky one, until all are corrected. After any
// program pick a sign pops up: all clear, or how many adjustments are needed
// with a button that takes the trainer to each; fixed ones turn green.
export default function InjuryCheckCard({
  clientId,
  clientName,
  injuries,
  trainingPlace,
  refreshKey,
  onAreas,
}: {
  clientId: string;
  clientName: string;
  /** The intake injuries box. */
  injuries: string | null;
  trainingPlace: ExercisePlace;
  /** Bumped when the plan changes; a new plan with risky exercises opens the walk-through. */
  refreshKey: number;
  /** The injured areas found, so other exercise pickers can show red and green too. */
  onAreas?: (areas: StabilityArea[]) => void;
}) {
  const [areas, setAreas] = useState<StabilityArea[]>([]);
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<Flagged | null>(null);
  const [step, setStep] = useState({ done: 0, total: 0 });
  const [showAll, setShowAll] = useState(false);
  // Exercises replaced in this visit, shown in green.
  const [fixed, setFixed] = useState<string[]>([]);
  // The injury check sign: shown after a program pick and when all are fixed.
  const [sign, setSign] = useState<"check" | "done" | null>(null);
  const seenKey = useRef(refreshKey);

  const check = useCallback(async (): Promise<Flagged[]> => {
    const today = todayIso();
    const [{ data: listed }, { data: pains }, { data: days }, { data: blocks }, { data: main }, { data: library }, changes] = await Promise.all([
      supabase.from("client_injuries").select("area, notes").eq("client_id", clientId).is("healed_on", null),
      supabase.from("client_problems").select("detail").eq("client_id", clientId).eq("topic", "pain").neq("status", "fixed"),
      supabase.from("client_calendar_workouts").select("program_id, day_slot").eq("client_id", clientId).gte("workout_date", today),
      supabase.from("client_calendar_blocks").select("program_id, day_slot").eq("client_id", clientId).gte("workout_date", today).is("removed_at", null),
      supabase.from("client_programs").select("program_id").eq("client_id", clientId).maybeSingle(),
      supabase.from("exercises").select("id, name, category"),
      loadExerciseChanges(clientId),
    ]);
    const found = injuryAreas(
      injuries,
      ...(listed ?? []).map((i) => `${i.area} ${i.notes ?? ""}`),
      ...(pains ?? []).map((p) => p.detail),
    );
    setAreas(found);
    onAreas?.(found);
    if (found.length === 0) return [];
    // Each program once, with the sessions used (null = the whole program).
    const uses = new Map<string, Set<number | null>>();
    for (const p of [...(days ?? []), ...(blocks ?? [])]) {
      const set = uses.get(p.program_id) ?? new Set();
      set.add(p.day_slot);
      uses.set(p.program_id, set);
    }
    if (main) uses.set(main.program_id, new Set([null]));
    const lists = await Promise.all([...uses.keys()].map((id) => loadProgramExercises(id).then(({ data }) => data ?? [])));
    const rows: ProgramExercise[] = [];
    [...uses.values()].forEach((slots, i) => {
      const all = lists[i];
      const picked = slots.has(null) ? all : [...slots].flatMap((s) => exercisesForSlot(all, s));
      rows.push(...applyExerciseChanges(picked, changes));
    });
    const category = new Map((library ?? []).map((e) => [e.id, e.category]));
    const out: Flagged[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.kind === "cardio") continue;
      const key = row.exercise_id ?? row.exercise_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const risks = exerciseRisks({ name: row.exercise_name, category: row.exercise_id ? category.get(row.exercise_id) : null }, found);
      if (risks.length) out.push({ row, risks });
    }
    return out;
  }, [clientId, injuries]);

  const load = useCallback(async () => {
    const list = await check();
    setFlagged(list);
    setLoading(false);
    return list;
  }, [check]);

  useEffect(() => {
    load().then(() => {
      // A program was just picked: put up the injury check sign.
      if (refreshKey !== seenKey.current) {
        setFixed([]);
        setSign("check");
      }
      seenKey.current = refreshKey;
    });
  }, [load, refreshKey]);

  const start = (list: Flagged[]) => {
    setSign(null);
    setStep({ done: 0, total: list.length });
    setFixing(list[0]);
  };

  const next = async () => {
    if (fixing) setFixed((f) => [...f, fixing.row.exercise_name]);
    const list = await load();
    if (list.length === 0) {
      setFixing(null);
      setSign("done");
      return;
    }
    setStep((s) => ({ done: s.done + 1, total: Math.max(s.total, s.done + 1 + list.length) }));
    setFixing(list[0]);
  };

  const names = areas.map((a) => findArea(a).title.toLowerCase()).join(", ");
  const shown = showAll ? flagged : flagged.slice(0, 3);
  const clear = flagged.length === 0;

  const signModal = (
    <Modal visible={!!sign} transparent animationType="fade" onRequestClose={() => setSign(null)}>
      <View style={styles.backdrop}>
        <View style={[styles.sign, { borderColor: clear ? GREEN : RED }]}>
          <Text style={styles.signIcon}>{clear ? "✅" : "🩹"}</Text>
          <Text style={styles.signHeading}>Injury liability check</Text>
          {clear ? (
            <>
              <Text style={[styles.signBig, { color: GREEN }]}>All clear</Text>
              <Text style={styles.signText}>
                {areas.length === 0
                  ? `${clientName} has no injuries listed.`
                  : sign === "done"
                    ? `Every exercise is now safe for ${clientName}'s ${names}.`
                    : `Nothing in this plan should aggravate ${clientName}'s ${names}.`}
              </Text>
              {fixed.map((n, i) => (
                <Text key={`${n}-${i}`} style={styles.fixedLine}>
                  ✓ {n} replaced
                </Text>
              ))}
              <Pressable style={[styles.fix, { backgroundColor: GREEN }]} onPress={() => setSign(null)}>
                <Text style={styles.fixText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.signBig, { color: RED }]}>
                {flagged.length} adjustment{flagged.length === 1 ? "" : "s"} required
              </Text>
              <Text style={styles.signText}>
                These may aggravate {clientName}'s {names}:
              </Text>
              {flagged.slice(0, 6).map((f) => (
                <Text key={f.row.id} style={styles.signRow}>
                  ✕ {f.row.exercise_name}
                </Text>
              ))}
              {flagged.length > 6 && <Text style={styles.signText}>and {flagged.length - 6} more</Text>}
              <Pressable style={styles.fix} onPress={() => start(flagged)}>
                <Text style={styles.fixText}>Take me to each one</Text>
              </Pressable>
              <Pressable style={styles.later} onPress={() => setSign(null)}>
                <Text style={styles.laterText}>Later</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) return <ActivityIndicator color={RED} style={{ marginTop: 10 }} />;
  if (areas.length === 0) return signModal;

  return (
    <View style={[styles.card, { borderColor: clear ? GREEN : RED }]}>
      {signModal}
      {fixed.map((n, i) => (
        <Text key={`${n}-${i}`} style={styles.fixedLine}>
          ✓ {n} replaced
        </Text>
      ))}
      {clear ? (
        <Text style={[styles.title, { color: GREEN }]}>✓ All clear: plan is safe for {clientName}'s {names}</Text>
      ) : (
        <>
          <Text style={[styles.title, { color: RED }]}>
            🩹 {flagged.length} adjustment{flagged.length === 1 ? "" : "s"} required for {clientName}'s {names}
          </Text>
          {shown.map((f) => (
            <View key={f.row.id} style={styles.row}>
              <Text style={styles.name}>✕ {f.row.exercise_name}</Text>
              <Text style={styles.why}>{riskLine(f.risks)}</Text>
            </View>
          ))}
          {flagged.length > 3 && (
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={6}>
              <Text style={styles.more}>{showAll ? "Show fewer ▴" : `Show all ${flagged.length} ▾`}</Text>
            </Pressable>
          )}
          <Pressable style={styles.fix} onPress={() => start(flagged)}>
            <Text style={styles.fixText}>Fix them one by one</Text>
          </Pressable>
        </>
      )}
      <ExerciseChangeModal
        row={fixing?.row ?? null}
        clientId={clientId}
        clientName={clientName}
        trainingPlace={trainingPlace}
        injuries={areas}
        stepLabel={fixing ? `${step.done + 1} of ${step.total}` : undefined}
        onClose={() => {
          setFixing(null);
          load();
        }}
        onSaved={next}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1.5 },
  title: { fontSize: 15, fontWeight: "800" },
  row: { marginTop: 8 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  why: { color: "#FCA5A5", fontSize: 12, marginTop: 1 },
  more: { color: "#94A3B8", fontWeight: "700", marginTop: 8 },
  fix: { backgroundColor: RED, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  fixText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  fixedLine: { color: GREEN, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.85)", justifyContent: "center", padding: 20 },
  sign: { backgroundColor: "#0F172A", borderRadius: 18, padding: 20, borderWidth: 2, alignItems: "stretch" },
  signIcon: { fontSize: 40, textAlign: "center" },
  signHeading: { color: "#94A3B8", fontWeight: "800", fontSize: 13, textAlign: "center", marginTop: 6, textTransform: "uppercase", letterSpacing: 1 },
  signBig: { fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 6 },
  signText: { color: "#CBD5E1", fontSize: 14, textAlign: "center", marginTop: 8, marginBottom: 4 },
  signRow: { color: RED, fontWeight: "700", fontSize: 14, marginTop: 4 },
  later: { alignItems: "center", paddingVertical: 12 },
  laterText: { color: "#94A3B8", fontWeight: "700" },
});
