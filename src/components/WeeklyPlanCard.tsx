import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { loadProgramExercises } from "@/lib/programQueries";
import { programSlots } from "@/lib/trainingCalendar";
import { daysLabel, planWeekDates, slotsFrom, splitAlongside, toggleDay } from "@/lib/trainingSplits";
import { nextPlanWeek, planSessionsBetween, planWeekOf } from "@/lib/weeklyPlans";
import type { ClientProgramPlan, Program } from "@/types/database";
import { themedStyles } from "@/lib/theme";
import { removeProgramFrom } from "@/lib/programRemoval";
import OptionsSheet from "@/components/OptionsSheet";

// Above the client's calendar (GRIZZ, 2026-10-18, 0113): each program planned
// week by week. When the client has 2 or fewer workouts left in the week on
// the calendar, the trainer is asked to go ahead with the next week, or make
// changes first.
export default function WeeklyPlanCard({
  clientId,
  clientName,
  programs,
  refreshKey,
  onChanged,
}: {
  clientId: string;
  clientName: string;
  programs: Program[];
  refreshKey?: unknown;
  onChanged: () => void;
}) {
  const [plans, setPlans] = useState<(ClientProgramPlan & { left: number })[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // The plan whose next week was just put on, so the loaded week stands out.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // A plan on different days each week: the days being picked for its next week.
  const [picking, setPicking] = useState<{ id: string; days: number[] } | null>(null);
  // The plan whose options are open (hold the card, or tap ⋯).
  const [options, setOptions] = useState<ClientProgramPlan | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("client_program_plans")
      .select("*")
      .eq("client_id", clientId)
      .is("ended_at", null)
      .order("created_at");
    const running = (data ?? []).filter((p) => nextPlanWeek(p));
    const withLeft = await Promise.all(
      running.map(async (p) => {
        const { data: left } = await supabase.rpc("plan_workouts_left", {
          p_plan_id: p.id,
        });
        return { ...p, left: left ?? 0 };
      }),
    );
    setPlans(withLeft);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Puts the next week on: empty days get the session as their workout, days
  // that already have one get it as an extra block, so nothing is wiped.
  const goAhead = async (plan: ClientProgramPlan, days?: number[]) => {
    const next = nextPlanWeek(plan);
    if (!next) return;
    if (plan.days_vary && !days) return setPicking({ id: plan.id, days: plan.split_days });
    setBusy(plan.id);
    const { data: rows } = await loadProgramExercises(plan.program_id);
    const slots = slotsFrom(programSlots(rows ?? []), plan.first_slot);
    const sessions =
      plan.days_vary && days
        ? planWeekDates(next.from, next.to, days, slots, plan.sessions_placed ?? 0)
        : planSessionsBetween(plan, slots, next.from, next.to);
    const [{ data: existing }, { data: blocks }] = await Promise.all([
      supabase
        .from("client_calendar_workouts")
        .select("workout_date")
        .eq("client_id", clientId)
        .gte("workout_date", next.from)
        .lte("workout_date", next.to),
      supabase
        .from("client_calendar_blocks")
        .select("workout_date, position")
        .eq("client_id", clientId)
        .is("removed_at", null)
        .gte("workout_date", next.from)
        .lte("workout_date", next.to),
    ]);
    const { mains, extras } = splitAlongside(
      sessions,
      (existing ?? []).map((e) => e.workout_date),
    );
    const nextPosition = (day: string) => Math.max(0, ...(blocks ?? []).filter((b) => b.workout_date === day).map((b) => b.position)) + 1;
    const now = new Date().toISOString();
    const [a, b] = await Promise.all([
      mains.length
        ? supabase.from("client_calendar_workouts").insert(
            mains.map((p) => ({
              client_id: clientId,
              workout_date: p.date,
              program_id: plan.program_id,
              day_slot: p.slot,
              created_at: now,
            })),
          )
        : null,
      extras.length
        ? supabase.from("client_calendar_blocks").insert(
            extras.map((p) => ({
              client_id: clientId,
              workout_date: p.date,
              program_id: plan.program_id,
              day_slot: p.slot,
              position: nextPosition(p.date),
            })),
          )
        : null,
    ]);
    const placed =
      plan.days_vary && days
        ? { placed_until: next.to, split_days: days, sessions_placed: (plan.sessions_placed ?? 0) + sessions.length }
        : { placed_until: next.to };
    const error = a?.error ?? b?.error ?? (await supabase.from("client_program_plans").update(placed).eq("id", plan.id)).error;
    setBusy(null);
    setPicking(null);
    if (error) return Alert.alert("Couldn't add the week", error.message);
    setJustAdded(plan.id);
    load();
    onChanged();
  };

  const stop = (plan: ClientProgramPlan, name: string) =>
    Alert.alert(`Stop ${name} here?`, `Nothing more is added after the week on the calendar now. ${clientName}'s workouts so far stay.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop here",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("client_program_plans").update({ ended_at: new Date().toISOString() }).eq("id", plan.id);
          if (error) Alert.alert("Couldn't stop it", error.message);
          load();
        },
      },
    ]);

  // Takes the whole program off from today (GRIZZ, 2026-11-14: "how would a
  // trainer remove one?"). Days already done stay as the client's history.
  const remove = (plan: ClientProgramPlan, name: string) =>
    Alert.alert(`Remove ${name}?`, `It comes off ${clientName}'s calendar from today on. Workouts already done stay.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(plan.id);
          const error = await removeProgramFrom(clientId, plan.program_id, todayIso());
          setBusy(null);
          if (error) Alert.alert("Couldn't remove it", error.message);
          load();
          onChanged();
        },
      },
    ]);

  const makeChanges = () =>
    Alert.alert(
      "Make changes first",
      `Tap any day on the calendar below and tap an exercise to swap it or change its sets and reps for ${clientName}. Changes made for every workout carry into the next weeks.`,
    );

  if (plans.length === 0) return null;
  const today = todayIso();

  return (
    <View>
      {plans.map((plan) => {
        const program = programs.find((p) => p.id === plan.program_id);
        const next = nextPlanWeek(plan);
        if (!program || !next) return null;
        const onWeek = Math.min(planWeekOf(plan, today < plan.start_date ? plan.start_date : today), next.week - 1);
        const due = plan.left <= 2;
        return (
          <Pressable key={plan.id} style={[styles.card, due && styles.due]} onLongPress={() => setOptions(plan)} delayLongPress={350}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { flex: 1 }]}>{program.name}</Text>
              <Pressable onPress={() => setOptions(plan)} hitSlop={10} accessibilityLabel="Program options">
                <Text style={styles.dots}>⋯</Text>
              </Pressable>
            </View>
            <View style={[styles.loaded, justAdded === plan.id && styles.loadedNew]}>
              <Text style={styles.loadedBig}>
                {justAdded === plan.id ? "✅ " : ""}Week {next.week - 1} of {plan.weeks} loaded
              </Text>
              <Text style={styles.loadedSub}>
                {justAdded === plan.id ? `Week ${next.week - 1} is now on ${clientName}'s calendar` : `On the calendar now. ${clientName} is on week ${Math.max(1, onWeek)}`}
              </Text>
            </View>
            {due ? (
              <>
                <Text style={styles.body}>
                  {clientName} has {plan.left === 0 ? "no" : plan.left} workout
                  {plan.left === 1 ? "" : "s"} left on the calendar. Add week {next.week}, or make changes first if they're struggling, it's
                  too easy or they have a problem.
                </Text>
                {picking?.id === plan.id ? (
                  <DayPicker
                    week={next.week}
                    days={picking.days}
                    busy={busy === plan.id}
                    onChange={(days) => setPicking({ id: plan.id, days })}
                    onAdd={() => goAhead(plan, picking.days)}
                  />
                ) : (
                  <Pressable style={styles.go} onPress={() => goAhead(plan)} disabled={busy === plan.id}>
                    <Text style={styles.goText}>
                      {busy === plan.id ? "Adding…" : plan.days_vary ? `✅ Go ahead: pick week ${next.week}'s days` : `✅ Go ahead: add week ${next.week}`}
                    </Text>
                  </Pressable>
                )}
                <View style={styles.row}>
                  <Pressable style={styles.secondary} onPress={makeChanges}>
                    <Text style={styles.secondaryText}>Make changes first</Text>
                  </Pressable>
                  <Pressable style={styles.secondary} onPress={() => stop(plan, program.name)}>
                    <Text style={styles.stopText}>Stop here</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  You'll be asked to add week {next.week} when {clientName} has 2 workouts left. Hold for options.
                </Text>
                {picking?.id === plan.id && (
                  <DayPicker
                    week={next.week}
                    days={picking.days}
                    busy={busy === plan.id}
                    onChange={(days) => setPicking({ id: plan.id, days })}
                    onAdd={() => goAhead(plan, picking.days)}
                  />
                )}
              </>
            )}
          </Pressable>
        );
      })}
      <OptionsSheet
        title={options ? (programs.find((p) => p.id === options.program_id)?.name ?? "Program") : null}
        subtitle={`${clientName}'s program`}
        onClose={() => setOptions(null)}
        options={(() => {
          const plan = options;
          const next = plan && nextPlanWeek(plan);
          if (!plan || !next) return [];
          const name = programs.find((p) => p.id === plan.program_id)?.name ?? "this program";
          return [
            {
              label: plan.days_vary ? `Add week ${next.week} now: pick its days` : `Add week ${next.week} now`,
              detail: "Puts next week on the calendar straight away",
              onPress: () => goAhead(plan),
            },
            { label: "Change a workout", detail: "Swap exercises or change sets and reps", onPress: makeChanges },
            { label: "Stop adding weeks", detail: "Keeps what's on the calendar, adds no more", onPress: () => stop(plan, name) },
            { label: "Remove program", detail: "Takes it off the calendar from today", danger: true, onPress: () => remove(plan, name) },
          ];
        })()}
      />
    </View>
  );
}

// Next week's days for a plan on different days each week.
function DayPicker({
  week,
  days,
  busy,
  onChange,
  onAdd,
}: {
  week: number;
  days: number[];
  busy: boolean;
  onChange: (days: number[]) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.picker}>
      <Text style={styles.pickerTitle}>Which days in week {week}?</Text>
      <View style={styles.row}>
        {["M", "T", "W", "T", "F", "S"].map((d, i) => {
          const on = days.includes(i + 1);
          return (
            <Pressable key={i} style={[styles.dayButton, on && styles.dayButtonOn]} onPress={() => onChange(toggleDay(days, i + 1))}>
              <Text style={[styles.dayButtonText, on && styles.dayButtonTextOn]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable style={[styles.go, days.length === 0 && styles.goOff]} onPress={onAdd} disabled={busy || days.length === 0}>
        <Text style={styles.goText}>{busy ? "Adding…" : days.length ? `✅ Add week ${week}: ${daysLabel(days)}` : "Pick at least one day"}</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles({
  picker: { marginTop: 10 },
  pickerTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dayButton: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#475569", alignItems: "center" },
  dayButtonOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  dayButtonText: { color: "#CBD5E1", fontWeight: "800" },
  dayButtonTextOn: { color: "#0F172A" },
  goOff: { opacity: 0.5 },
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  due: { borderColor: BRAND_GOLD, backgroundColor: "#2A2410" },
  title: { color: "#fff", fontWeight: "800", fontSize: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dots: { color: BRAND_GOLD, fontWeight: "900", fontSize: 22, lineHeight: 22, paddingHorizontal: 4 },
  loaded: { backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 4, borderLeftColor: BRAND_GOLD },
  loadedNew: { backgroundColor: "#14532D", borderLeftColor: "#22C55E" },
  loadedBig: { color: "#fff", fontWeight: "900", fontSize: 20 },
  loadedSub: { color: "#E2E8F0", fontSize: 13, marginTop: 2 },
  body: { color: "#CBD5E1", fontSize: 13, lineHeight: 18, marginTop: 4 },
  link: { color: BRAND_GOLD, fontWeight: "800" },
  go: {
    backgroundColor: "#D4AF37",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 10,
  },
  goText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  secondaryText: { color: "#E2E8F0", fontWeight: "700" },
  stopText: { color: "#EF4444", fontWeight: "700" },
});
