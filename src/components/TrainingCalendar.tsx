import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { CALENDAR_WEEKDAYS, monthLabel, monthWeeks, shiftMonth, type CalendarMonth, type CalendarMove } from "@/lib/trainingCalendar";

// A month grid, Monday first, with the workout on each day (0069). The
// trainer taps a day to plan it; the client's copy is read-only, or opens a
// day's details through onPressDay. Days the client trained carry a green,
// orange or red dot and any gold star (0076). Recovery activities show in
// bright green (0107).
export default function TrainingCalendar({
  month,
  onChangeMonth,
  labels,
  today,
  selected,
  onPressDay,
  marks,
  moves,
  recovery,
}: {
  month: CalendarMonth;
  onChangeMonth: (month: CalendarMonth) => void;
  /** Date → short workout name. */
  labels: Record<string, string>;
  today: string;
  selected?: string | null;
  onPressDay?: (date: string) => void;
  /** Date → how the client's workout went (0076): a coloured dot, and a star. */
  marks?: Record<string, { color: string; star: boolean }>;
  /** Weekend catch-ups (0101): "Moved" in red on the missed day, green on the day it was done. */
  moves?: Record<string, CalendarMove>;
  /** Date → recovery activities planned or done that day (0107), in bright green. */
  recovery?: Record<string, { label: string; done: boolean }[]>;
}) {
  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => onChangeMonth(shiftMonth(month, -1))} hitSlop={12} accessibilityLabel="Previous month">
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{monthLabel(month)}</Text>
        <Pressable onPress={() => onChangeMonth(shiftMonth(month, 1))} hitSlop={12} accessibilityLabel="Next month">
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {CALENDAR_WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {monthWeeks(month).map((week, i) => (
        <View key={i} style={styles.row}>
          {week.map((date, j) => {
            if (!date) return <View key={j} style={styles.cell} />;
            const move = moves?.[date];
            const label = move === "missed" ? undefined : labels[date];
            const mark = marks?.[date];
            const rec = recovery?.[date];
            const past = date < today && !mark && !move && !rec;
            return (
              <Pressable
                key={date}
                style={[
                  styles.cell,
                  styles.day,
                  label && styles.planned,
                  date === today && styles.today,
                  date === selected && styles.selected,
                  past && styles.past,
                ]}
                onPress={onPressDay ? () => onPressDay(date) : undefined}
                disabled={!onPressDay}
                accessibilityRole={onPressDay ? "button" : undefined}
                accessibilityLabel={`${Number(date.slice(8))} ${monthLabel(month)}${label ? `, ${label}` : ", nothing planned"}`}
              >
                <View style={styles.dayTop}>
                  <Text style={[styles.dayNumber, label && styles.dayNumberPlanned]}>{Number(date.slice(8))}</Text>
                  {mark && (
                    <View style={styles.markRow}>
                      {mark.star && <Text style={styles.star}>⭐</Text>}
                      <View style={[styles.markDot, { backgroundColor: mark.color }]} />
                    </View>
                  )}
                </View>
                {label ? (
                  <Text style={styles.label} numberOfLines={move ? 1 : 2}>
                    {label}
                  </Text>
                ) : null}
                {move ? <Text style={[styles.moved, { color: move === "missed" ? "#EF4444" : "#22C55E" }]}>Moved</Text> : null}
                {rec ? (
                  <Text style={styles.recovery} numberOfLines={1}>
                    {rec[0].done ? "✓ " : "🌿 "}
                    {rec[0].label}
                    {rec.length > 1 ? ` +${rec.length - 1}` : ""}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  arrow: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700", paddingHorizontal: 8 },
  month: { color: "#fff", fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", gap: 3, marginBottom: 3 },
  weekday: { flex: 1, textAlign: "center", color: "#64748B", fontSize: 11, fontWeight: "700" },
  cell: { flex: 1, minHeight: 50 },
  day: { backgroundColor: "#0F172A", borderRadius: 6, padding: 3, borderWidth: 1, borderColor: "transparent" },
  planned: { backgroundColor: "#2A2410", borderColor: "#5C4D1A" },
  today: { borderColor: "#22C55E" },
  selected: { borderColor: BRAND_GOLD, borderWidth: 2 },
  past: { opacity: 0.5 },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  markRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  markDot: { width: 8, height: 8, borderRadius: 4 },
  star: { fontSize: 8 },
  dayNumber: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  dayNumberPlanned: { color: "#fff" },
  label: { color: BRAND_GOLD, fontSize: 9.5, fontWeight: "700", marginTop: 2 },
  moved: { fontSize: 9.5, fontWeight: "800", marginTop: 2 },
  recovery: { color: "#4ADE80", fontSize: 9.5, fontWeight: "800", marginTop: 2 },
});
