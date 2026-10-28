import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { applyExerciseChanges } from "@/lib/exerciseChanges";
import { loadExerciseChanges, loadProgramExercises } from "@/lib/programQueries";
import { exercisesForSlot } from "@/lib/trainingCalendar";
import { checkRisks, exerciseKey, exerciseRisks, injuryAreas, keepCovers, riskLine, type InjuryRisk } from "@/lib/injuryRisk";
import { findArea } from "@/lib/stability";
import type { StabilityArea } from "@/lib/stability";
import ExerciseChangeModal from "@/components/ExerciseChangeModal";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { ProgramExercise } from "@/types/database";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

const AMBER = "#F59E0B";
const GREEN = "#22C55E";

type Flagged = { row: ProgramExercise; risks: InjuryRisk[] };
type Kept = Flagged & { reason: string };

// Injury check (GRIZZ, 2026-10-17), at the top of the client's Training tab.
// Takes the client's injuries (intake box and open pain reports), looks at
// every exercise in their plan from today on (calendar days and any main
// program), and lists the ones worth checking. "Check them" walks the
// trainer through each one in ExerciseChangeModal, which suggests 3 swaps
// with nothing to check, or lets the trainer keep it with a reason (load,
// range, tempo...). Since the 2026-10-18 review it's a warning, not a block
// or a safety clearance: a name check can't judge load or diagnosis. After any
// program pick a sign pops up: no clashes found, or how many to check.
export default function InjuryCheckCard({
  clientId,
  clientName,
  injuries,
  trainingPlace,
  refreshKey,
  onAreas,
  onShow,
}: {
  clientId: string;
  clientName: string;
  /** The intake injuries box (null once the trainer marks it healed). */
  injuries: string | null;
  trainingPlace: ExercisePlace;
  /** Bumped when the plan changes; a new plan with risky exercises opens the walk-through. */
  refreshKey: number;
  /** The injured areas found, so other exercise pickers can show red and green too. */
  onAreas?: (areas: StabilityArea[]) => void;
  /** Whether it has something to show, for the Things to check line. */
  onShow?: (shown: boolean) => void;
}) {
  const [areas, setAreas] = useState<StabilityArea[]>([]);
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  // Flagged exercises the trainer kept anyway, with why (0119).
  const [kept, setKept] = useState<Kept[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<Flagged | null>(null);
  const [step, setStep] = useState({ done: 0, total: 0 });
  const [showAll, setShowAll] = useState(false);
  // Exercises checked (swapped, adjusted or kept) in this visit, shown in green.
  const [fixed, setFixed] = useState<string[]>([]);
  // The injury check sign: shown after a program pick and when all are fixed.
  const [sign, setSign] = useState<"check" | "done" | null>(null);
  const seenKey = useRef(refreshKey);

  const check = useCallback(async (): Promise<{ flagged: Flagged[]; kept: Kept[] }> => {
    const today = todayIso();
    const [{ data: listed }, { data: pains }, { data: days }, { data: blocks }, { data: main }, { data: library }, changes, { data: keeps }] = await Promise.all([
      supabase.from("client_injuries").select("area, notes").eq("client_id", clientId).is("healed_on", null),
      supabase.from("client_problems").select("detail").eq("client_id", clientId).eq("topic", "pain").neq("status", "fixed"),
      supabase.from("client_calendar_workouts").select("program_id, day_slot").eq("client_id", clientId).gte("workout_date", today),
      supabase.from("client_calendar_blocks").select("program_id, day_slot").eq("client_id", clientId).gte("workout_date", today).is("removed_at", null),
      supabase.from("client_programs").select("program_id").eq("client_id", clientId).maybeSingle(),
      supabase.from("exercises").select("id, name, category"),
      loadExerciseChanges(clientId),
      supabase.from("client_injury_keeps").select("exercise_key, areas, reason").eq("client_id", clientId),
    ]);
    const found = injuryAreas(
      injuries,
      ...(listed ?? []).map((i) => `${i.area} ${i.notes ?? ""}`),
      ...(pains ?? []).map((p) => p.detail),
    );
    setAreas(found);
    onAreas?.(found);
    if (found.length === 0) return { flagged: [], kept: [] };
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
    const keepOf = new Map((keeps ?? []).map((k) => [k.exercise_key, k]));
    const out: Flagged[] = [];
    const keptOut: Kept[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.kind === "cardio") continue;
      const key = row.exercise_id ?? row.exercise_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Only risks worth checking; gentle rehab notes show in the change screen.
      const risks = checkRisks(exerciseRisks({ name: row.exercise_name, category: row.exercise_id ? category.get(row.exercise_id) : null }, found));
      if (!risks.length) continue;
      const keep = keepOf.get(exerciseKey({ exercise_id: row.exercise_id, name: row.exercise_name }));
      if (keep && keepCovers(keep, risks)) keptOut.push({ row, risks, reason: keep.reason });
      else out.push({ row, risks });
    }
    return { flagged: out, kept: keptOut };
  }, [clientId, injuries]);

  const load = useCallback(async () => {
    const result = await check();
    setFlagged(result.flagged);
    setKept(result.kept);
    setLoading(false);
    return result.flagged;
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

  const hasAreas = !loading && areas.length > 0;
  useEffect(() => onShow?.(hasAreas), [hasAreas, onShow]);

  const signModal = (
    <Modal visible={!!sign} transparent animationType="fade" onRequestClose={() => setSign(null)}>
      <View style={styles.backdrop}>
        <View style={[styles.sign, { borderColor: themeBorder(clear ? GREEN : AMBER) }]}>
          <Text style={styles.signIcon}>{clear ? "✅" : "🩹"}</Text>
          <Text style={styles.signHeading}>Injury check</Text>
          {clear ? (
            <>
              <Text style={[styles.signBig, { color: themeText(GREEN) }]}>No clashes found</Text>
              <Text style={styles.signText}>
                {areas.length === 0
                  ? `${clientName} has no injuries listed.`
                  : `No clashes found with ${clientName}'s listed injuries (${names}). This is a name check, not a clinical assessment: watch how they respond and adjust.`}
              </Text>
              {fixed.map((n, i) => (
                <Text key={`${n}-${i}`} style={styles.fixedLine}>
                  ✓ {n} checked
                </Text>
              ))}
              <Pressable style={[styles.fix, { backgroundColor: themeBg(GREEN) }]} onPress={() => setSign(null)}>
                <Text style={styles.fixText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.signBig, { color: themeText(AMBER) }]}>
                {flagged.length} exercise{flagged.length === 1 ? "" : "s"} to check
              </Text>
              <Text style={styles.signText}>
                These may aggravate {clientName}'s {names}. Adjust the load, range or tempo, swap them, or keep them with a reason:
              </Text>
              {flagged.slice(0, 6).map((f) => (
                <Text key={f.row.id} style={styles.signRow}>
                  ⚠ {f.row.exercise_name}
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

  if (loading) return <ActivityIndicator color={themeText(AMBER)} style={{ marginTop: 10 }} />;
  if (areas.length === 0) return signModal;

  return (
    <View style={[styles.card, { borderColor: themeBorder(clear ? GREEN : AMBER) }]}>
      {signModal}
      {fixed.map((n, i) => (
        <Text key={`${n}-${i}`} style={styles.fixedLine}>
          ✓ {n} checked
        </Text>
      ))}
      {clear ? (
        <Text style={[styles.title, { color: themeText(GREEN) }]}>✓ Injury check: no clashes found with {clientName}'s listed injuries ({names})</Text>
      ) : (
        <>
          <Text style={[styles.title, { color: themeText(AMBER) }]}>
            🩹 Injury check: {flagged.length} exercise{flagged.length === 1 ? "" : "s"} to check for {clientName}'s {names}
          </Text>
          {shown.map((f) => (
            <View key={f.row.id} style={styles.row}>
              <Text style={styles.name}>⚠ {f.row.exercise_name}</Text>
              <Text style={styles.why}>{riskLine(f.risks)}</Text>
            </View>
          ))}
          {flagged.length > 3 && (
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={6}>
              <Text style={styles.more}>{showAll ? "Show fewer ▴" : `Show all ${flagged.length} ▾`}</Text>
            </Pressable>
          )}
          <Pressable style={styles.fix} onPress={() => start(flagged)}>
            <Text style={styles.fixText}>Check them one by one</Text>
          </Pressable>
        </>
      )}
      {kept.map((k) => (
        <Pressable key={k.row.id} onPress={() => setFixing(k)} hitSlop={4}>
          <Text style={styles.keptLine}>
            Kept: {k.row.exercise_name} ({k.reason.toLowerCase()})
          </Text>
        </Pressable>
      ))}
      <Text style={styles.small}>A name check, not a clinical assessment. Watch how they respond and adjust.</Text>
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

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1.5 },
  title: { fontSize: 15, fontWeight: "800" },
  row: { marginTop: 8 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  why: { color: "#FCD34D", fontSize: 12, marginTop: 1 },
  keptLine: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  small: { color: "#64748B", fontSize: 12, marginTop: 8 },
  more: { color: "#94A3B8", fontWeight: "700", marginTop: 8 },
  fix: { backgroundColor: AMBER, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  fixText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  fixedLine: { color: GREEN, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.85)", justifyContent: "center", padding: 20 },
  sign: { backgroundColor: "#0F172A", borderRadius: 18, padding: 20, borderWidth: 2, alignItems: "stretch" },
  signIcon: { fontSize: 40, textAlign: "center" },
  signHeading: { color: "#94A3B8", fontWeight: "800", fontSize: 13, textAlign: "center", marginTop: 6, textTransform: "uppercase", letterSpacing: 1 },
  signBig: { fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 6 },
  signText: { color: "#CBD5E1", fontSize: 14, textAlign: "center", marginTop: 8, marginBottom: 4 },
  signRow: { color: AMBER, fontWeight: "700", fontSize: 14, marginTop: 4 },
  later: { alignItems: "center", paddingVertical: 12 },
  laterText: { color: "#94A3B8", fontWeight: "700" },
});
