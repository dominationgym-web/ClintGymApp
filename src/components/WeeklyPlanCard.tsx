import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { loadProgramExercises } from "@/lib/programQueries";
import { programSlots } from "@/lib/trainingCalendar";
import { splitAlongside } from "@/lib/trainingSplits";
import { nextPlanWeek, planSessionsBetween, planWeekOf } from "@/lib/weeklyPlans";
import type { ClientProgramPlan, Program } from "@/types/database";

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
  const goAhead = async (plan: ClientProgramPlan) => {
    const next = nextPlanWeek(plan);
    if (!next) return;
    setBusy(plan.id);
    const { data: rows } = await loadProgramExercises(plan.program_id);
    const sessions = planSessionsBetween(plan, programSlots(rows ?? []), next.from, next.to);
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
    const error =
      a?.error ?? b?.error ?? (await supabase.from("client_program_plans").update({ placed_until: next.to }).eq("id", plan.id)).error;
    setBusy(null);
    if (error) return Alert.alert("Couldn't add the week", error.message);
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

  const makeChanges = () =>
    Alert.alert(
      "Make changes first",
      `Tap any day on the calendar below and tap an exercise to swap it or change its sets and reps for ${clientName}. Changes made for every workout carry into the next weeks. When you're happy, tap Go ahead.`,
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
          <View key={plan.id} style={[styles.card, due && styles.due]}>
            <Text style={styles.title}>
              🗓 {program.name} · week {Math.max(1, onWeek)} of {plan.weeks}
            </Text>
            {due ? (
              <>
                <Text style={styles.body}>
                  {clientName} has {plan.left === 0 ? "no" : plan.left} workout
                  {plan.left === 1 ? "" : "s"} left on the calendar. Add week {next.week}, or make changes first if they're struggling, it's
                  too easy or they have a problem.
                </Text>
                <Pressable style={styles.go} onPress={() => goAhead(plan)} disabled={busy === plan.id}>
                  <Text style={styles.goText}>{busy === plan.id ? "Adding…" : `✅ Go ahead: add week ${next.week}`}</Text>
                </Pressable>
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
              <Text style={styles.body}>
                Week by week: you'll be asked to add week {next.week} when {clientName} has 2 workouts left.{" "}
                <Text style={styles.link} onPress={() => goAhead(plan)}>
                  Add it now
                </Text>
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  body: { color: "#CBD5E1", fontSize: 13, lineHeight: 18, marginTop: 4 },
  link: { color: BRAND_GOLD, fontWeight: "800" },
  go: {
    backgroundColor: "#22C55E",
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
