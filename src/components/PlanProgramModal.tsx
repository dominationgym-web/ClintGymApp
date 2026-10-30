import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate } from "@/lib/dates";
import { firstWeekEnd } from "@/lib/weeklyPlans";
import { loadProgramExercises } from "@/lib/programQueries";
import { programEasyWeeks } from "@/lib/deload";
import { WEEKDAY_NAMES } from "@/lib/programs";
import { levelOf, PROGRAM_GOALS, programGoal, programsForGoal, type GoalChoice } from "@/lib/programGoals";
import { monthLabel, monthOf, programSlots } from "@/lib/trainingCalendar";
import {
  MAX_PLAN_WEEKS,
  blockFirstSlot,
  programBlockWeeks,
  slotsFrom,
  defaultWeeks,
  findSplit,
  planProgramDates,
  sessionsPerWeek,
  daysLabel,
  splitAlongside,
  splitNote,
  weeksToFinish,
  suggestedSplit,
  toggleDay,
} from "@/lib/trainingSplits";
import { findArea, findProgram, LEVELS, levelInfo, STABILITY_AREAS } from "@/lib/stability";
import RehabRedFlagCheck from "@/components/stability/RehabRedFlagCheck";
import type { StabilityArea, StabilityLevel } from "@/lib/stability";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { Program } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";


function dayHeading(date: string): string {
  const d = parseIsoDate(date);
  return `${WEEKDAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${monthLabel(monthOf(date))}`;
}

// Tap a day on the client's calendar → pick the client's goal → the program
// that fits their level shows first (src/lib/programGoals.ts) → pick it → tap the days the client trains → Activate, and the program's
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
  trainingLevel = null,
  clientDays = [],
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
  // From the intake form: picks the best-fit program for their goal.
  trainingLevel?: string | null;
  // The days they said on the intake form they train (1 = Monday ... 7 = Sunday).
  clientDays?: number[];
  programs: Program[];
  resetNotice: string | null;
  startWith?: Program | null;
  onSingleWorkout?: (date: string) => void;
  onDone: (what: "calendar" | "stability") => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<GoalChoice | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [allSlots, setSlots] = useState<number[] | null>(null);
  // Longevity and Muscle Year programs: the block to start at (GRIZZ, 2026-10-20). 1 for every other program.
  const [block, setBlock] = useState(1);
  const blockWeeks = program ? programBlockWeeks(program.name) : null;
  const blocks = program && blockWeeks ? Math.floor((program.weeks ?? 0) / blockWeeks) : 0;
  const firstSlot = block > 1 && blockWeeks ? blockFirstSlot(block, blockWeeks) : null;
  const slots = allSlots && slotsFrom(allSlots, firstSlot);
  const weeksLeft = (p: Program, b: number) => (p.weeks ?? 1) - (b - 1) * (blockWeeks ?? 0);
  // The trainer's own days (GRIZZ, 2026-10-19), the same every week or
  // picked again each week when the client trains on different days.
  const [ownDays, setOwnDays] = useState<number[]>([]);
  const [daysVary, setDaysVary] = useState(false);
  // The program's own easy weeks (review 2026-10-18), to show where they land.
  const [easyWeeks, setEasyWeeks] = useState<number[]>([]);
  const [area, setArea] = useState<StabilityArea | null>(null);
  // Rehab level tapped: the red-flag tick-list shows before it starts.
  const [checkingFlags, setCheckingFlags] = useState(false);
  const [busy, setBusy] = useState(false);
  // Sunday is always rest, so only Monday to Saturday can be ticked.
  const formDays = clientDays.filter((d) => d <= 6);
  const sameAsForm = formDays.length === ownDays.length && formDays.every((d) => ownDays.includes(d));

  useEffect(() => {
    if (!date) return;
    setType(null);
    setProgram(null);
    setSlots(null);
    setArea(null);
    setCheckingFlags(false);
    if (startWith) pickProgram(startWith);
  }, [date, trainingPlace, startWith?.id]);

  const pickProgram = async (p: Program) => {
    setProgram(p);
    setSlots(null);
    setBlock(1);
    const { data } = await loadProgramExercises(p.id);
    const list = programSlots(data ?? []);
    setEasyWeeks(programEasyWeeks(data ?? []));
    setSlots(list);
    // The program's own number of days, ticked to start with (GRIZZ, 2026-10-20:
    // "the trainer should just select the days of the week his client plans to use").
    // Their own days from the intake form instead, when they fit the program (GRIZZ, 2026-10-30).
    setOwnDays(formDays.length === sessionsPerWeek(list) ? formDays : findSplit(suggestedSplit(sessionsPerWeek(list))).days);
    setDaysVary(false);
  };

  const back = () => {
    if (program) return startWith ? onClose() : setProgram(null);
    if (checkingFlags) return setCheckingFlags(false);
    if (area) return setArea(null);
    setType(null);
  };

  // A split with a different number of days than the program: the length
  // becomes what it takes to finish the whole program on those days.
  const fullLength = (days: number[], list = slots) =>
    list && program && (program.weeks ?? 1) > 1 && days.length > 0 && days.length !== sessionsPerWeek(list)
      ? Math.min(MAX_PLAN_WEEKS, weeksToFinish(list.length, days.length))
      : null;
  // Fewer days than a long program has: it would take more than 52 weeks, so
  // the plan stops at 52 (the client can carry on with a new plan after).
  const cutShort = !!(slots && ownDays.length > 0 && weeksToFinish(slots.length, ownDays.length) > MAX_PLAN_WEEKS && ownDays.length !== sessionsPerWeek(slots));
  const chosenDays = ownDays;
  const chosenLabel = daysLabel(ownDays);
  // Always the whole program (or the rest of it from the block picked), spread
  // over the days picked, so there's no "how long" to choose.
  const weeks = program ? (fullLength(chosenDays) ?? defaultWeeks(weeksLeft(program, block))) : 4;

  const plan = date && slots ? planProgramDates(date, chosenDays, slots, weeks) : [];
  const note =
    slots && program && (program.weeks ?? 1) > 1
      ? splitNote(plan, sessionsPerWeek(slots), chosenDays.length, slots.length, easyWeeks.map((w) => w - (block - 1) * (blockWeeks ?? 0)).filter((w) => w > 0))
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
    const vary = daysVary && more;
    const summary =
      (vary
        ? `${chosenLabel} in week 1, then days you pick each week, for ${weeks} weeks, from ${dayHeading(plan[0].date)}.`
        : `${chosenLabel} for ${weeks} week${weeks === 1 ? "" : "s"}, from ${dayHeading(plan[0].date)}.`) +
      (more
        ? ` Week 1 (${week1.length} session${week1.length === 1 ? "" : "s"}) goes on the calendar now. When ${clientName} has 2 workouts left, you'll be asked to go ahead with the next week${vary ? " and pick its days" : ""}, so you can make changes first.`
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
          split_days: chosenDays,
          days_vary: vary,
          sessions_placed: week1.length,
          first_slot: firstSlot,
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

  const level = levelOf(trainingLevel);
  const fits = type && type !== "rehab" ? programsForGoal(programs, type, trainingPlace, level) : { best: null, others: [] };
  const goals = PROGRAM_GOALS.filter((g) => g.key !== "own" || programs.some((p) => p.kind === "weekly" && programGoal(p) === "own"));

  const title = !date
    ? ""
    : program
      ? program.name
      : type === "rehab"
        ? area
          ? `${findArea(area).title}: which level?`
          : "Rehab & stability"
        : type
          ? (PROGRAM_GOALS.find((g) => g.key === type)?.title ?? "Pick a program")
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
                <Text style={styles.step}>What's {clientName}'s goal?</Text>
                {goals.map((g) => (
                  <Pressable key={g.key} style={styles.typeRow} onPress={() => setType(g.key)}>
                    <Text style={styles.typeIcon}>{g.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeTitle}>{g.title}</Text>
                      <Text style={styles.typeSummary}>{g.summary}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
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
                {fits.best && (
                  <>
                    <Text style={styles.step}>Best fit{level ? ` for a ${level === "beginner" ? "beginner" : level}` : ""}</Text>
                    <Pressable style={[styles.program, styles.bestFit]} onPress={() => pickProgram(fits.best!)}>
                      <Text style={styles.programName}>⭐ {fits.best.name}</Text>
                      {fits.best.description ? (
                        <Text style={styles.description} numberOfLines={2}>
                          {fits.best.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  </>
                )}
                {fits.others.length > 0 && <Text style={styles.step}>{fits.best ? "Or another one" : "Pick a program"}</Text>}
                {fits.others.map((p) => (
                  <Pressable key={p.id} style={styles.program} onPress={() => pickProgram(p)}>
                    <Text style={styles.programName}>{p.name}</Text>
                    {p.description ? (
                      <Text style={styles.description} numberOfLines={2}>
                        {p.description}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
                {!fits.best && fits.others.length === 0 && (
                  <Text style={styles.description}>No programs for this goal yet. Pick one workout for this day instead.</Text>
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
                  <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 16 }} />
                ) : slots.length === 0 ? (
                  <Text style={styles.description}>This program has no exercises yet.</Text>
                ) : (
                  <>
                    {blocks > 1 && (
                      <>
                        <Text style={styles.step}>Start at which block?</Text>
                        <View style={styles.chips}>
                          {Array.from({ length: blocks }, (_, i) => i + 1).map((b) => (
                            <Pressable key={`block-${b}`} style={[styles.chip, b === block && styles.chipOn]} onPress={() => setBlock(b)}>
                              <Text style={[styles.chipText, b === block && styles.chipTextOn]}>
                                Block {b} (weeks {(b - 1) * (blockWeeks ?? 0) + 1}-{b * (blockWeeks ?? 0)})
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={styles.description}>Pick a later block when {clientName} is ready to progress, or the same block again to repeat it.</Text>
                      </>
                    )}
                    <Text style={styles.step}>Which days will {clientName} train?</Text>
                    <Text style={styles.description}>
                      Tap their days. {sessionsPerWeek(slots)} sessions a week as written. Sunday is always a rest day.
                    </Text>
                    {clientDays.length > 0 && (
                      <Pressable onPress={() => formDays.length > 0 && setOwnDays(formDays)} disabled={sameAsForm || formDays.length === 0}>
                        <Text style={styles.formDays}>
                          📋 On their form: {daysLabel(clientDays)}
                          {clientDays.includes(7) ? " (Sunday stays a rest day)" : ""}
                          {!sameAsForm && formDays.length > 0 ? "  ·  Tap to use their days" : ""}
                        </Text>
                      </Pressable>
                    )}
                    <View style={styles.dayButtons}>
                      {["M", "T", "W", "T", "F", "S"].map((d, i) => {
                        const on = ownDays.includes(i + 1);
                        return (
                          <Pressable key={i} style={[styles.dayButton, on && styles.dayButtonOn]} onPress={() => setOwnDays(toggleDay(ownDays, i + 1))}>
                            <Text style={[styles.dayButtonText, on && styles.dayButtonTextOn]}>{d}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {ownDays.length > 0 && (
                      <View style={styles.chips}>
                        <Pressable style={[styles.chip, !daysVary && styles.chipOn]} onPress={() => setDaysVary(false)}>
                          <Text style={[styles.chipText, !daysVary && styles.chipTextOn]}>🔁 Same days every week</Text>
                        </Pressable>
                        <Pressable style={[styles.chip, daysVary && styles.chipOn]} onPress={() => setDaysVary(true)}>
                          <Text style={[styles.chipText, daysVary && styles.chipTextOn]}>🎲 Different days each week</Text>
                        </Pressable>
                      </View>
                    )}
                    {daysVary && ownDays.length > 0 && (
                      <Text style={styles.ownHint}>Each week you'll pick the next week's days, and the program carries on in order.</Text>
                    )}
                    {note && <Text style={styles.splitNote}>⚠️ {note}</Text>}
                    {cutShort && (
                      <Text style={styles.splitNote}>
                        ⚠️ A plan can run for up to {MAX_PLAN_WEEKS} weeks, so this one stops there. To get through the whole program in a year, pick a program
                        made for {ownDays.length} days a week{program && programBlockWeeks(program.name) === 13 ? ` (Muscle Year – ${ownDays.length} days a week)` : ""}.
                      </Text>
                    )}
                    {plan.length > 0 && (
                      <Text style={styles.summary}>
                        {plan.length} workouts over {weeks} week{weeks === 1 ? "" : "s"}, first one {dayHeading(plan[0].date)}.
                      </Text>
                    )}
                    <Pressable style={styles.activate} onPress={activate} disabled={busy || plan.length === 0}>
                      {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.activateText}>Activate program</Text>}
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

const styles = themedStyles({
  bestFit: { borderWidth: 1.5, borderColor: BRAND_GOLD },
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
  program: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, margin: 6, marginTop: 6, borderWidth: 1, borderColor: "#1E293B" },
  programName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  description: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  formDays: { color: BRAND_GOLD, fontSize: 12.5, fontWeight: "600", lineHeight: 18, marginTop: 6, marginBottom: 6 },
  ownHint: { color: "#94A3B8", fontSize: 12, lineHeight: 17, marginTop: 2 },
  dayButtons: { flexDirection: "row", gap: 6 },
  dayButton: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#475569", alignItems: "center" },
  dayButtonOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  dayButtonText: { color: "#CBD5E1", fontWeight: "800" },
  dayButtonTextOn: { color: "#0F172A" },
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
