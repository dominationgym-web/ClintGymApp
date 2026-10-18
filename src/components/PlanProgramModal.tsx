import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate } from "@/lib/dates";
import { firstWeekEnd } from "@/lib/weeklyPlans";
import { loadProgramExercises } from "@/lib/programQueries";
import { programEasyWeeks } from "@/lib/deload";
import { PROGRAM_FAMILIES, PROGRAM_GROUPS, programFamily, programGroupHeading, WEEKDAY_NAMES, type ProgramFamily, type ProgramGroup } from "@/lib/programs";
import { monthLabel, monthOf, programSlots } from "@/lib/trainingCalendar";
import {
  defaultWeeks,
  findSplit,
  planProgramDates,
  sessionsPerWeek,
  splitAlongside,
  splitNote,
  weeksToFinish,
  suggestedSplit,
  TRAINING_SPLITS,
  WEEK_CHOICES,
  type SplitKey,
} from "@/lib/trainingSplits";
import { findArea, findProgram, LEVELS, levelInfo, STABILITY_AREAS } from "@/lib/stability";
import RehabRedFlagCheck from "@/components/stability/RehabRedFlagCheck";
import type { StabilityArea, StabilityLevel } from "@/lib/stability";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { Program } from "@/types/database";

type PlanType = ProgramGroup | "rehab";

function dayHeading(date: string): string {
  const d = parseIsoDate(date);
  return `${WEEKDAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${monthLabel(monthOf(date))}`;
}

// Tap a day on the client's calendar → pick Gym, Performance, Functional or
// Rehab → pick a program → pick the split → Activate, and the program's
// sessions are laid over those weekdays from that day (GRIZZ, 2026-10-17).
// One page at a time, so nothing to scroll through. Sunday is always rest.
// With startWith (the foundation card's Approve, review 2026-10-18), it opens
// on that program's split page, so every program goes on the calendar.
export default function PlanProgramModal({
  date,
  clientId,
  clientName,
  trainerId,
  trainingPlace,
  programs,
  resetNotice,
  startWith = null,
  onSingleWorkout,
  onDone,
  onClose,
}: {
  date: string | null;
  clientId: string;
  clientName: string;
  trainerId?: string;
  trainingPlace: ExercisePlace;
  programs: Program[];
  resetNotice: string | null;
  startWith?: Program | null;
  onSingleWorkout?: (date: string) => void;
  onDone: (what: "calendar" | "stability") => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<PlanType | null>(null);
  const [place, setPlace] = useState<ExercisePlace>(trainingPlace);
  const [openFamily, setOpenFamily] = useState<ProgramFamily | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [split, setSplit] = useState<SplitKey>("mon_wed_fri");
  const [weeks, setWeeks] = useState(4);
  // The program's own easy weeks (review 2026-10-18), to show where they land.
  const [easyWeeks, setEasyWeeks] = useState<number[]>([]);
  const [area, setArea] = useState<StabilityArea | null>(null);
  // Rehab level tapped: the red-flag tick-list shows before it starts.
  const [checkingFlags, setCheckingFlags] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    setType(null);
    setPlace(trainingPlace);
    setOpenFamily(null);
    setProgram(null);
    setSlots(null);
    setArea(null);
    setCheckingFlags(false);
    if (startWith) pickProgram(startWith);
  }, [date, trainingPlace, startWith?.id]);

  const pickProgram = async (p: Program) => {
    setProgram(p);
    setSlots(null);
    setWeeks(defaultWeeks(p.weeks));
    const { data } = await loadProgramExercises(p.id);
    const list = programSlots(data ?? []);
    setEasyWeeks(programEasyWeeks(data ?? []));
    setSlots(list);
    setSplit(suggestedSplit(sessionsPerWeek(list)));
  };

  const back = () => {
    if (program) return startWith ? onClose() : setProgram(null);
    if (checkingFlags) return setCheckingFlags(false);
    if (area) return setArea(null);
    setType(null);
  };

  // A split with a different number of days than the program: the length
  // becomes what it takes to finish the whole program on those days.
  const fullLength = (key: SplitKey) =>
    slots && program && (program.weeks ?? 1) > 1 && findSplit(key).days.length !== sessionsPerWeek(slots)
      ? weeksToFinish(slots.length, findSplit(key).days.length)
      : null;
  const pickSplit = (key: SplitKey) => {
    setSplit(key);
    if (program) setWeeks(fullLength(key) ?? defaultWeeks(program.weeks));
  };

  const plan = date && slots ? planProgramDates(date, findSplit(split).days, slots, weeks) : [];
  const note =
    slots && program && (program.weeks ?? 1) > 1
      ? splitNote(plan, sessionsPerWeek(slots), findSplit(split).days.length, slots.length, easyWeeks)
      : null;

  const activate = async () => {
    if (!date || !program || plan.length === 0) return;
    const end = plan[plan.length - 1].date;
    const [{ data: current }, { data: existing }, { data: blocks }] = await Promise.all([
      supabase.from("client_programs").select("program_id").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_calendar_workouts").select("workout_date").eq("client_id", clientId).gte("workout_date", date).lte("workout_date", end),
      supabase
        .from("client_calendar_blocks")
        .select("workout_date, position")
        .eq("client_id", clientId)
        .is("removed_at", null)
        .gte("workout_date", date)
        .lte("workout_date", end),
    ]);
    const currentName = current ? programs.find((p) => p.id === current.program_id)?.name : null;
    const taken = (existing ?? []).map((e) => e.workout_date);
    // One week at a time (GRIZZ, 2026-10-18, 0113): only the first week goes
    // on now; the trainer adds each next week with Go ahead when the client
    // has 2 workouts left.
    const weekEnd = firstWeekEnd({ start_date: date, weeks });
    const week1 = plan.filter((p) => p.date <= weekEnd);
    const more = plan.some((p) => p.date > weekEnd);
    const summary =
      `${findSplit(split).label} for ${weeks} week${weeks === 1 ? "" : "s"}, from ${dayHeading(plan[0].date)}.` +
      (more
        ? ` Week 1 (${week1.length} session${week1.length === 1 ? "" : "s"}) goes on the calendar now. When ${clientName} has 2 workouts left, you'll be asked to go ahead with the next week, so you can make changes first.`
        : "");
    const now = new Date().toISOString();
    const savePlan = async () => {
      if (!more) return null;
      const trainer = trainerId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!trainer) return { message: "Sign in again to plan week by week." };
      return (
        await supabase.from("client_program_plans").insert({
          client_id: clientId,
          trainer_id: trainer,
          program_id: program.id,
          start_date: date,
          split_days: findSplit(split).days,
          weeks,
          placed_until: weekEnd,
        })
      ).error;
    };

    const finish = (error: { message: string } | null | undefined) => {
      setBusy(false);
      if (error) return Alert.alert("Couldn't save the plan", error.message);
      onDone("calendar");
    };

    // The new plan takes over those weeks: what was on them is replaced.
    const replace = async () => {
      setBusy(true);
      const cleared = await supabase
        .from("client_calendar_workouts")
        .delete()
        .eq("client_id", clientId)
        .gte("workout_date", date)
        .lte("workout_date", end);
      const added = cleared.error
        ? cleared
        : await supabase.from("client_calendar_workouts").insert(
            week1.map((p) => ({ client_id: clientId, workout_date: p.date, program_id: program.id, day_slot: p.slot, created_at: now })),
          );
      // Only the calendar shows from now on, so the old main program stops.
      const stopped = !added.error && current ? await supabase.from("client_programs").delete().eq("client_id", clientId) : null;
      const planned = added.error || stopped?.error ? null : await savePlan();
      finish(added.error ?? stopped?.error ?? planned);
    };

    // Stretching, mobility or rehab on top of their training (GRIZZ,
    // 2026-10-18): nothing already planned is touched. Busy days get the
    // session as an extra block under their workout.
    const alongside = async () => {
      setBusy(true);
      const { mains, extras } = splitAlongside(week1, taken);
      const nextPosition = (day: string) =>
        Math.max(0, ...(blocks ?? []).filter((b) => b.workout_date === day).map((b) => b.position)) + 1;
      const [a, b] = await Promise.all([
        mains.length
          ? supabase.from("client_calendar_workouts").insert(
              mains.map((p) => ({ client_id: clientId, workout_date: p.date, program_id: program.id, day_slot: p.slot, created_at: now })),
            )
          : null,
        extras.length
          ? supabase.from("client_calendar_blocks").insert(
              extras.map((p) => ({ client_id: clientId, workout_date: p.date, program_id: program.id, day_slot: p.slot, position: nextPosition(p.date) })),
            )
          : null,
      ]);
      const planned = a?.error || b?.error ? null : await savePlan();
      finish(a?.error ?? b?.error ?? planned);
    };

    if (taken.length === 0) {
      Alert.alert(
        `Activate ${program.name}?`,
        `${summary}` +
          (currentName ? ` ${clientName} comes off ${currentName}, so only the calendar shows.` : "") +
          " You can still change any single day after.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Activate", onPress: replace },
        ],
      );
      return;
    }
    Alert.alert(
      `Add ${program.name}?`,
      `${summary} ${clientName} already has ${taken.length} workout${taken.length === 1 ? "" : "s"} planned in those weeks. ` +
        `Add it alongside keeps them and puts this session under the workout on days they share. ` +
        `Replace takes them off the calendar.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Replace", style: "destructive", onPress: replace },
        { text: "Add it alongside", onPress: alongside },
      ],
    );
  };

  const startStability = (a: StabilityArea, l: StabilityLevel) => {
    if (!date) return;
    const name = `${findArea(a).title} ${levelInfo(l).label}`;
    Alert.alert(`Start ${name}?`, `${clientName} starts ${name} (${findProgram(a, l).weeks} weeks) on ${dayHeading(date)}, alongside their training days.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start",
        onPress: async () => {
          setBusy(true);
          // One program per area: a running one in this area ends first.
          const ended = await supabase
            .from("client_stability_programs")
            .update({ ended_at: new Date().toISOString() })
            .eq("client_id", clientId)
            .eq("area", a)
            .is("ended_at", null);
          const { error } = ended.error
            ? ended
            : await supabase.from("client_stability_programs").insert({ client_id: clientId, area: a, level: l, started_on: date });
          // No automatic note (GRIZZ: never ready-made messages from trainer
          // to client). It shows on their calendar in purple.
          setBusy(false);
          if (error) return Alert.alert("Couldn't start the program", error.message);
          onDone("stability");
        },
      },
    ]);
  };

  const here = programs.filter((p) => p.kind === "weekly" && p.place === place);
  const families =
    type && type !== "rehab"
      ? PROGRAM_FAMILIES.filter((f) => f.group === type)
          .map((f) => ({ ...f, programs: here.filter((p) => programFamily(p) === f.key) }))
          .filter((f) => f.programs.length > 0)
      : [];

  const title = !date
    ? ""
    : program
      ? program.name
      : type === "rehab"
        ? area
          ? `${findArea(area).title}: which level?`
          : "Rehab & stability"
        : type
          ? "Pick a program"
          : `Start on ${dayHeading(date)}`;

  return (
    <Modal visible={!!date} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {(type || program) && (
              <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back">
                <Text style={styles.back}>‹</Text>
              </Pressable>
            )}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {resetNotice ? <Text style={styles.reset}>🌿 {resetNotice}</Text> : null}
          <ScrollView contentContainerStyle={{ paddingBottom: 4 }}>
            {/* Step 1: what kind of training. */}
            {!type && !program && date && (
              <>
                <Text style={styles.step}>What does {clientName} want to focus on?</Text>
                {PROGRAM_GROUPS.map((g) => {
                  const { title: t, icon } = programGroupHeading(g, place);
                  return (
                    <Pressable key={g.key} style={styles.typeRow} onPress={() => setType(g.key)}>
                      <Text style={styles.typeIcon}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.typeTitle}>{t}</Text>
                        <Text style={styles.typeSummary}>{g.summary}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.typeRow} onPress={() => setType("rehab")}>
                  <Text style={styles.typeIcon}>🛡️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.typeTitle}>Rehab</Text>
                    <Text style={styles.typeSummary}>Stability and injury programs for ankle, knee, hip, core, shoulder, wrist and neck</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
                {onSingleWorkout && (
                  <Pressable style={styles.single} onPress={() => onSingleWorkout(date)}>
                    <Text style={styles.singleText}>Or just one workout for this day</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* Step 2: the programs of that kind, under tap-to-open headings. */}
            {type && type !== "rehab" && !program && (
              <>
                <GymHomeTabs
                  current={place}
                  onChange={(next) => {
                    setPlace(next);
                    setOpenFamily(null);
                  }}
                  accent={BRAND_GOLD}
                  labels={PROGRAM_PLACE_LABELS}
                />
                {families.map((f) => {
                  const isOpen = openFamily === f.key || families.length === 1;
                  return (
                    <View key={f.key} style={[styles.family, isOpen && styles.familyOpen]}>
                      <Pressable style={styles.familyHeader} onPress={() => setOpenFamily(isOpen ? null : f.key)}>
                        <Text style={styles.typeIcon}>{f.icon}</Text>
                        <Text style={[styles.familyTitle, { flex: 1 }]}>{f.title}</Text>
                        <Text style={styles.count}>{f.programs.length}</Text>
                        <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
                      </Pressable>
                      {isOpen &&
                        f.programs.map((p) => (
                          <Pressable key={p.id} style={styles.program} onPress={() => pickProgram(p)}>
                            <Text style={styles.programName}>{p.name}</Text>
                            {p.description ? (
                              <Text style={styles.description} numberOfLines={2}>
                                {p.description}
                              </Text>
                            ) : null}
                          </Pressable>
                        ))}
                    </View>
                  );
                })}
                {families.length === 0 && (
                  <Text style={styles.description}>
                    No full {place} programs here yet. Pick one workout for this day instead.
                  </Text>
                )}
                {date && onSingleWorkout && (
                  <Pressable style={styles.single} onPress={() => onSingleWorkout(date)}>
                    <Text style={styles.singleText}>Or just one workout for this day</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* Step 3: the split and how long, then Activate. */}
            {program && (
              <>
                {!slots ? (
                  <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 16 }} />
                ) : slots.length === 0 ? (
                  <Text style={styles.description}>This program has no exercises yet.</Text>
                ) : (
                  <>
                    <Text style={styles.step}>Which days will {clientName} train?</Text>
                    <Text style={styles.description}>
                      {sessionsPerWeek(slots)} sessions a week as written. Sunday is always a rest day.
                    </Text>
                    <View style={styles.splitTable}>
                      {TRAINING_SPLITS.map((s) => {
                        const on = s.key === split;
                        return (
                          <Pressable key={s.key} style={[styles.splitRow, on && styles.splitRowOn]} onPress={() => pickSplit(s.key)}>
                            <Text style={[styles.splitLabel, on && styles.splitLabelOn]}>{s.label}</Text>
                            <View style={styles.dots}>
                              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                                <Text key={i} style={[styles.dot, s.days.includes(i + 1) && styles.dotOn, i === 6 && styles.dotRest]}>
                                  {d}
                                </Text>
                              ))}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.step}>For how long?</Text>
                    <View style={styles.chips}>
                      {[...new Set([...WEEK_CHOICES, defaultWeeks(program.weeks), ...(fullLength(split) ? [fullLength(split) as number] : [])])]
                        .sort((a, b) => a - b)
                        .map((w) => (
                          <Pressable key={w} style={[styles.chip, w === weeks && styles.chipOn]} onPress={() => setWeeks(w)}>
                            <Text style={[styles.chipText, w === weeks && styles.chipTextOn]}>{w} weeks</Text>
                          </Pressable>
                        ))}
                    </View>
                    {note && <Text style={styles.splitNote}>⚠️ {note}</Text>}
                    {plan.length > 0 && (
                      <Text style={styles.summary}>
                        {plan.length} workouts, first one {dayHeading(plan[0].date)}.
                      </Text>
                    )}
                    <Pressable style={styles.activate} onPress={activate} disabled={busy || plan.length === 0}>
                      {busy ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.activateText}>Activate program</Text>}
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* Rehab: area, then level. These run alongside the training days. */}
            {type === "rehab" && !area && (
              <>
                <Text style={styles.description}>Runs alongside {clientName}'s training days. Which area?</Text>
                <View style={styles.chips}>
                  {STABILITY_AREAS.map((a) => (
                    <Pressable key={a.area} style={styles.chip} onPress={() => setArea(a.area)}>
                      <Text style={styles.chipText}>
                        {a.icon} {a.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {type === "rehab" && area && checkingFlags && (
              <RehabRedFlagCheck
                area={area}
                clientName={clientName}
                onClear={() => {
                  setCheckingFlags(false);
                  startStability(area, "rehab");
                }}
                onRefer={onClose}
              />
            )}
            {type === "rehab" &&
              area &&
              !checkingFlags &&
              LEVELS.map((l) => (
                <Pressable
                  key={l.level}
                  style={styles.program}
                  onPress={() => (l.level === "rehab" ? setCheckingFlags(true) : startStability(area, l.level))}
                  disabled={busy}
                >
                  <Text style={styles.programName}>
                    {l.icon} {l.label} · {l.weeks} weeks
                  </Text>
                  <Text style={styles.description}>{findArea(area).chooseLevel[l.level]}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.8)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#0F172A", borderRadius: 16, padding: 16, maxHeight: "90%", borderWidth: 1, borderColor: "#1E293B" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  back: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700", marginTop: -4 },
  title: { color: "#fff", fontWeight: "800", fontSize: 17, flex: 1 },
  close: { color: "#94A3B8", fontSize: 20, fontWeight: "700" },
  reset: { color: "#FDE68A", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  step: { color: "#fff", fontSize: 15, fontWeight: "800", marginTop: 8, marginBottom: 4 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#111C33", borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: "#1E293B" },
  typeIcon: { fontSize: 24 },
  typeTitle: { color: "#fff", fontWeight: "800", fontSize: 17 },
  typeSummary: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chevron: { color: "#94A3B8", fontSize: 18 },
  single: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  singleText: { color: BRAND_GOLD, fontWeight: "700" },
  family: { backgroundColor: "#1E293B", borderRadius: 12, marginTop: 8, padding: 4 },
  familyOpen: { borderWidth: 1, borderColor: BRAND_GOLD },
  familyHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  familyTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  count: { color: BRAND_GOLD, fontWeight: "800" },
  program: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, margin: 6, marginTop: 6, borderWidth: 1, borderColor: "#1E293B" },
  programName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  description: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  splitTable: { marginTop: 8, gap: 6 },
  splitRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 10, padding: 10, borderWidth: 1.5, borderColor: "transparent" },
  splitRowOn: { borderColor: BRAND_GOLD, backgroundColor: "#2A2410" },
  splitLabel: { color: "#CBD5E1", fontWeight: "700", fontSize: 14, flex: 1 },
  splitLabelOn: { color: BRAND_GOLD },
  dots: { flexDirection: "row", gap: 3 },
  dot: { width: 18, textAlign: "center", color: "#475569", fontSize: 11, fontWeight: "800" },
  dotOn: { color: "#fff" },
  dotRest: { color: "#334155" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { borderColor: BRAND_GOLD, backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
  summary: { color: "#CBD5E1", fontSize: 13, marginTop: 12 },
  splitNote: { color: "#FDE68A", fontSize: 13, lineHeight: 18, marginTop: 12 },
  activate: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  activateText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
