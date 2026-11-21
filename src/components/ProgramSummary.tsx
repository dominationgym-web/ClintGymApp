import React, { useState } from "react";
import { View, Text } from "react-native";
import Pressable from "@/components/Pressable";
import { cardioLabel, slotOf, WEEKDAY_NAMES } from "@/lib/programs";
import type { Program, ProgramExercise } from "@/types/database";
import ExerciseInfoModal from "@/components/ExerciseInfoModal";
import { themedStyles } from "@/lib/theme";

/** Rest as a short clock, "1:15" or "0:45", so a whole week fits one screen. "–" for none (a superset). */
export function shortRest(seconds: number): string {
  if (!seconds) return "–";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Reps said short for the compact table ("20-30s ea"), with anything after a
 * comma ("6-8, stand up quickly, lower slowly") kept as a note under the row.
 */
export function splitReps(reps: string): { short: string; note: string | null } {
  const cut = reps.indexOf(",");
  const main = cut > 0 ? reps.slice(0, cut) : reps;
  const note = cut > 0 ? reps.slice(cut + 1).trim() || null : null;
  return { short: shortReps(main), note };
}

export function shortReps(reps: string): string {
  return reps
    .replace(/\s*each side/i, " ea")
    .replace(/\s*each leg/i, " ea")
    .replace(/\s*each arm/i, " ea")
    .replace(/\s*sec(ond)?s?\b/i, "s")
    .trim();
}

// A program's week as one compact table (GRIZZ, 2026-11-16: "the full week
// structure on 1 screen. Exercise - Sets - Reps - Rest. To see the exercise
// must click on it"). Each training day is a gold heading with one thin row per
// exercise; rest days are one line at the end. Tapping a row opens its video
// and How to do it. Where tapping changes the exercise (a client's own
// workout, the trainer's own program), a small ▶ at the end still opens the
// video. Multi-week programs show one week at a time with ◀ ▶.
export default function ProgramSummary({
  program,
  exercises,
  onPressExercise,
  onlySlot = null,
  tapHint,
  hideHint = false,
  onPressCardio,
}: {
  program: Program;
  exercises: ProgramExercise[];
  onPressExercise?: (row: ProgramExercise) => void;
  /** Just this session of a weekly program, for a single day on the calendar (GRIZZ, 2026-10-16). */
  onlySlot?: number | null;
  /** What tapping an exercise does, when it isn't changing it for one client. */
  tapHint?: string;
  /** The screen around it already says what tapping does (the week screen's title). */
  hideHint?: boolean;
  /** Tapping a cardio block, e.g. to take it off the client's workout (0140). */
  onPressCardio?: (row: ProgramExercise) => void;
}) {
  const [info, setInfo] = useState<ProgramExercise | null>(null);
  const weeks = program.weeks ?? 1;
  const allDays =
    onlySlot != null
      ? [onlySlot]
      : program.kind !== "weekly"
      ? [1]
      : weeks > 1
        ? [...new Set(exercises.map(slotOf))].sort((a, b) => a - b)
        : [1, 2, 3, 4, 5, 6, 7];
  const weekOf = (slot: number) => Math.floor((slot - 1) / 7) + 1;
  const weekList = onlySlot == null && weeks > 1 ? [...new Set(allDays.map(weekOf))] : [];
  const [weekAt, setWeekAt] = useState(0);
  const at = Math.min(weekAt, Math.max(0, weekList.length - 1));
  const days = weekList.length > 1 ? allDays.filter((d) => weekOf(d) === weekList[at]) : allDays;
  const rowsOf = (day: number) => exercises.filter((e) => slotOf(e) === day).sort((a, b) => a.sort_order - b.sort_order);
  const weekly = program.kind === "weekly";
  // Rest days go on one line at the end, so training days get the room.
  const restDays = weekly && onlySlot == null ? days.filter((d) => rowsOf(d).length === 0) : [];
  const trainDays = weekly && onlySlot == null ? days.filter((d) => rowsOf(d).length > 0) : days;
  const short = (day: number) => WEEKDAY_NAMES[(day - 1) % 7].slice(0, 3);
  return (
    <View>
      {program.warm_up ? <Text style={styles.line}>Warm-up: {program.warm_up}</Text> : null}
      {hideHint ? null : <Text style={styles.tapHint}>
        {onPressExercise
          ? tapHint ?? "Tap an exercise to change it, or its sets and reps, for this client. Tap ▶ to watch it."
          : "Tap an exercise to watch it and see how to do it."}
      </Text>}
      {weekList.length > 1 ? (
        <View style={styles.weekStep}>
          <Pressable onPress={() => setWeekAt(Math.max(0, at - 1))} disabled={at === 0} hitSlop={10} accessibilityLabel="Week before">
            <Text style={[styles.weekArrow, at === 0 && styles.weekArrowOff]}>◀</Text>
          </Pressable>
          <Text style={styles.weekStepText}>
            Week {weekList[at]} of {weekList[weekList.length - 1]}
          </Text>
          <Pressable
            onPress={() => setWeekAt(Math.min(weekList.length - 1, at + 1))}
            disabled={at === weekList.length - 1}
            hitSlop={10}
            accessibilityLabel="Next week"
          >
            <Text style={[styles.weekArrow, at === weekList.length - 1 && styles.weekArrowOff]}>▶</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.colHead}>
        <Text style={[styles.colHeadText, styles.nameCol]}>EXERCISE</Text>
        <Text style={[styles.colHeadText, styles.setsCol]}>SETS</Text>
        <Text style={[styles.colHeadText, styles.repsCol]}>REPS</Text>
        <Text style={[styles.colHeadText, styles.restCol]}>REST</Text>
        {onPressExercise ? <View style={styles.playCol} /> : null}
      </View>
      {trainDays.map((day) => {
        const rows = rowsOf(day);
        const i = trainDays.indexOf(day);
        const newWeek = weeks > 1 && weekList.length <= 1 && onlySlot == null && (i === 0 || weekOf(trainDays[i - 1]) !== weekOf(day));
        const count = rows.filter((r) => r.kind !== "cardio").length;
        return (
          <View key={day}>
            {newWeek ? <Text style={styles.week}>Week {weekOf(day)}</Text> : null}
            {/* A single calendar day already says its day and title above. */}
            {weekly && onlySlot == null && (
              <View style={styles.dayHead}>
                <Text style={styles.day} numberOfLines={1}>
                  {short(day)} · {program.day_titles[day - 1] ?? ""}
                </Text>
                <Text style={styles.dayCount}>{count} ex</Text>
              </View>
            )}
            {rows.length === 0 ? (
              <Text style={styles.line}>Rest</Text>
            ) : (
              rows.map((r) => {
                if (r.kind === "cardio") {
                  return onPressCardio ? (
                    <Pressable key={r.id} onPress={() => onPressCardio(r)} hitSlop={4} accessibilityRole="button" style={styles.cardioRow}>
                      <Text style={[styles.cardio, { flex: 1 }]}>Cardio: {cardioLabel(r)}</Text>
                      <Text style={styles.cardioOff}>✕</Text>
                    </Pressable>
                  ) : (
                    <Text key={r.id} style={[styles.cardio, styles.cardioRow]}>
                      Cardio: {cardioLabel(r)}
                    </Text>
                  );
                }
                const reps = splitReps(r.reps);
                const was = r.changed_from
                  ? r.changed_from.exercise_name !== r.exercise_name
                    ? `✎ changed, was ${r.changed_from.exercise_name}`
                    : `✎ changed, was ${r.changed_from.sets} x ${r.changed_from.reps}`
                  : r.swapped_from
                    ? `⇄ for now, was ${r.swapped_from.exercise_name}`
                    : null;
                return (
                  <View key={r.id} style={styles.rowWrap}>
                    <Pressable
                      style={styles.row}
                      onPress={() => (onPressExercise ? onPressExercise(r) : setInfo(r))}
                      hitSlop={2}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.exercise_name}, ${r.sets} sets of ${r.reps}`}
                    >
                      <Text style={[styles.cell, styles.nameCol, (r.changed_from || r.swapped_from) && styles.changed]} numberOfLines={2}>
                        {r.exercise_name}
                      </Text>
                      <Text style={[styles.cell, styles.num, styles.setsCol]}>{r.sets}</Text>
                      <Text style={[styles.cell, styles.num, styles.repsCol]} numberOfLines={1}>
                        {reps.short}
                      </Text>
                      <Text style={[styles.cell, styles.num, styles.restCol]}>{shortRest(r.rest_seconds)}</Text>
                      {onPressExercise ? (
                        <Pressable onPress={() => setInfo(r)} hitSlop={8} style={styles.playCol} accessibilityLabel={`Watch ${r.exercise_name}`}>
                          <Text style={styles.play}>▶</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                    {reps.note ? <Text style={styles.note}>{reps.note}</Text> : null}
                    {was ? <Text style={styles.was}>{was}</Text> : null}
                  </View>
                );
              })
            )}
          </View>
        );
      })}
      {restDays.length > 0 ? <Text style={styles.restLine}>Rest: {restDays.map(short).join(", ")}</Text> : null}
      <ExerciseInfoModal exercise={info} onClose={() => setInfo(null)} />
    </View>
  );
}

const styles = themedStyles({
  week: { color: "#D4AF37", fontWeight: "800", fontSize: 13, marginTop: 6 },
  weekStep: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  weekStepText: { color: "#D4AF37", fontWeight: "800", fontSize: 14 },
  weekArrow: { color: "#D4AF37", fontSize: 18, fontWeight: "800" },
  weekArrowOff: { color: "#334155" },
  line: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  tapHint: { color: "#D4AF37", fontSize: 12, marginTop: 4 },
  colHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, marginTop: 4 },
  colHeadText: { color: "#64748B", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  dayHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderLeftWidth: 3,
    borderLeftColor: "#D4AF37",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginTop: 3,
  },
  day: { flex: 1, color: "#D4AF37", fontWeight: "800", fontSize: 12, lineHeight: 16 },
  dayCount: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
  rowWrap: { borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  cell: { color: "#E2E8F0", fontSize: 12, lineHeight: 14 },
  num: { color: "#CBD5E1", textAlign: "center" },
  nameCol: { flex: 1, paddingRight: 4 },
  setsCol: { width: 30, textAlign: "center" },
  repsCol: { width: 66, textAlign: "center" },
  restCol: { width: 38, textAlign: "center" },
  playCol: { width: 22, alignItems: "flex-end" },
  play: { color: "#22C55E", fontSize: 13, fontWeight: "900" },
  changed: { color: "#fff", fontWeight: "700" },
  was: { color: "#D4AF37", fontSize: 11, fontWeight: "600", paddingHorizontal: 8, marginTop: -2, marginBottom: 2 },
  note: { color: "#94A3B8", fontSize: 11, paddingHorizontal: 8, marginTop: -2, marginBottom: 2 },
  cardioRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 2 },
  cardio: { color: "#94A3B8", fontSize: 12.5 },
  cardioOff: { color: "#F87171", fontWeight: "800", fontSize: 15, marginLeft: 10 },
  restLine: { color: "#64748B", fontSize: 12, marginTop: 6, paddingHorizontal: 8 },
});
