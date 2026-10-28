import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { addDays, sessionTitle, weekdayOf } from "@/lib/programSchedule";
import { displayProgramName, isFunctionalProgram } from "@/lib/programs";
import { supabase } from "@/lib/supabase";
import { SWAP_DAYS_AHEAD, nextSwapDate, swapBlocked, swapDayName } from "@/lib/workoutSwaps";
import type { ClientWorkoutSwap, Program } from "@/types/database";

// Swap with tomorrow (0167, GRIZZ, 2026-10-28: "If a client doesn't feel like
// doing legs that day, can they swap to the next day's workout?"). On today's
// calendar workout: swap it with the next training workout (up to 7 days on),
// or, once swapped, undo it while nothing is logged. The coach is told.
export default function WorkoutSwapRow({
  clientId,
  today,
  todayName,
  startedToday,
  refreshKey,
  onSwapped,
}: {
  clientId: string;
  today: string;
  /** Today's workout, for the question. */
  todayName: string;
  /** A set is logged or the workout is finished today, so it can't be swapped. */
  startedToday: boolean;
  refreshKey?: unknown;
  /** Today's workout changed: reload the screen. */
  onSwapped: () => void;
}) {
  const [next, setNext] = useState<{ date: string; name: string } | null>(null);
  const [swaps, setSwaps] = useState<ClientWorkoutSwap[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      supabase
        .from("client_calendar_workouts")
        .select("workout_date, program_id, day_slot")
        .eq("client_id", clientId)
        .gt("workout_date", today)
        .lte("workout_date", addDays(today, SWAP_DAYS_AHEAD)),
      supabase
        .from("client_workout_swaps")
        .select("*")
        .eq("client_id", clientId)
        .is("undone_at", null)
        .or(`swapped_on.eq.${today},later_date.eq.${today}`),
    ]).then(async ([{ data: rows }, { data: swapRows }]) => {
      const ids = [...new Set((rows ?? []).map((r) => r.program_id))];
      const { data: programs } = ids.length
        ? await supabase.from("programs").select("id, name, trainer_id, day_titles, weeks").in("id", ids)
        : { data: [] as Pick<Program, "id" | "name" | "trainer_id" | "day_titles" | "weeks">[] };
      if (!live) return;
      const byId = new Map((programs ?? []).map((p) => [p.id, p]));
      const date = nextSwapDate(today, rows ?? [], (id) => {
        const p = byId.get(id);
        return !!p && !isFunctionalProgram(p);
      });
      const entry = date ? (rows ?? []).find((r) => r.workout_date === date) : null;
      const program = entry ? byId.get(entry.program_id) : null;
      // One session of a weekly program goes by its title ("Lower A"), not the program's name.
      const name = program && entry?.day_slot != null ? sessionTitle(program, entry.day_slot) : program ? displayProgramName(program) : "";
      setNext(date && program ? { date, name } : null);
      setSwaps(swapRows ?? []);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [clientId, today, refreshKey]);

  if (!loaded) return null;
  const blocked = swapBlocked(today, swaps, startedToday);
  const mine = swaps.find((s) => s.swapped_on === today);
  const swappedIn = swaps.find((s) => s.later_date === today);

  const swap = () => {
    if (!next) return;
    const day = swapDayName(today, next.date);
    Alert.alert(
      `Swap with ${day} workout?`,
      `You'll do ${next.name} today, and ${todayName} moves to ${weekdayOf(next.date)}. Your coach will be told.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Swap",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("swap_my_workout", { p_with: next.date });
            setBusy(false);
            if (error) {
              Alert.alert("Couldn't swap", error.message);
              return;
            }
            onSwapped();
          },
        },
      ],
    );
  };

  const undo = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("undo_my_workout_swap");
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't undo", error.message);
      return;
    }
    onSwapped();
  };

  if (mine) {
    return (
      <View style={styles.note}>
        <Text style={styles.noteText}>
          🔄 Swapped: today's planned workout moved to {weekdayOf(mine.later_date)}. Your coach knows.
        </Text>
        {!startedToday &&
          (busy ? (
            <ActivityIndicator color={BRAND_GOLD} />
          ) : (
            <Pressable onPress={undo} hitSlop={8} accessibilityRole="button">
              <Text style={styles.undo}>Undo</Text>
            </Pressable>
          ))}
      </View>
    );
  }
  if (swappedIn) {
    return (
      <View style={styles.note}>
        <Text style={styles.noteText}>🔄 Swapped here from {weekdayOf(swappedIn.swapped_on)}, so this one stays today.</Text>
      </View>
    );
  }
  if (blocked || !next) return null;
  return (
    <Pressable style={styles.chip} onPress={swap} disabled={busy} accessibilityRole="button">
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.chipText}>
          🔄 Not feeling it? Swap with {swapDayName(today, next.date)} {next.name}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#334155",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginTop: 4,
    marginBottom: 8,
  },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
  },
  noteText: { color: "#E2E8F0", fontSize: 13, flex: 1 },
  undo: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13 },
});
