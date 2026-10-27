import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { DELOAD_BLUE } from "@/lib/deload";
import { STABILITY_PURPLE, type StabilityCalendarItem } from "@/lib/stabilityCalendar";
import { CALENDAR_WEEKDAYS, FUNCTIONAL_TEAL, weekDates, weekLabel, type CalendarMove } from "@/lib/trainingCalendar";

const RECOVERY_GREEN = "#4ADE80";

export type WeekDayPlan = {
  /** The day's main workout and the body parts it trains. */
  main?: { title: string; parts: string; deload: boolean; addOns?: string };
  /** Extra sessions on the day; functional ones (mobility, flexibility) show in teal. */
  extras: { title: string; functional: boolean }[];
};

// The client's week, Monday to Sunday (GRIZZ, 2026-10-18): one big slot per
// day with the workout and the body parts it trains in gold, mobility and
// flexibility in teal, stability in purple and recovery in green, so they can
// see the whole week at a glance. A deload week's workouts are in blue. Days
// trained carry a green, orange or red dot (0076). Tap a day for its details.
export default function WeekCalendar({
  monday,
  onChangeWeek,
  today,
  selected,
  onPressDay,
  plans,
  marks,
  moves,
  recovery,
  stability,
  client = false,
}: {
  monday: string;
  onChangeWeek: (direction: -1 | 1) => void;
  today: string;
  selected?: string | null;
  onPressDay?: (date: string) => void;
  plans: Record<string, WeekDayPlan>;
  marks?: Record<string, { color: string; star: boolean; live?: boolean }>;
  moves?: Record<string, CalendarMove>;
  recovery?: Record<string, { label: string; done: boolean }[]>;
  stability?: Record<string, StabilityCalendarItem[]>;
  /** The client's own calendar, so the words speak to them. */
  client?: boolean;
}) {
  const days = weekDates(monday);
  const thisWeek = days.includes(today);
  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => onChangeWeek(-1)} hitSlop={12} accessibilityLabel="Previous week">
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.week}>{thisWeek ? "This week" : weekLabel(monday)}</Text>
          {thisWeek && <Text style={styles.weekDates}>{weekLabel(monday)}</Text>}
        </View>
        <Pressable onPress={() => onChangeWeek(1)} hitSlop={12} accessibilityLabel="Next week">
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
      {days.map((date, i) => {
        const plan = plans[date] ?? { extras: [] };
        const move = moves?.[date];
        const main = move === "missed" ? undefined : plan.main;
        const mark = marks?.[date];
        const rec = recovery?.[date] ?? [];
        const stab = stability?.[date] ?? [];
        const empty = !main && !mark?.live && plan.extras.length === 0 && rec.length === 0 && stab.length === 0;
        return (
          <Pressable
            key={date}
            style={[
              styles.day,
              main && (main.deload ? styles.deloadDay : styles.trainingDay),
              date === today && styles.today,
              date === selected && styles.selected,
              date < today && !mark && styles.past,
            ]}
            onPress={onPressDay ? () => onPressDay(date) : undefined}
            disabled={!onPressDay}
            accessibilityRole={onPressDay ? "button" : undefined}
          >
            <View style={styles.dateCol}>
              <Text style={[styles.weekday, date === today && styles.todayText]}>{CALENDAR_WEEKDAYS[i]}</Text>
              <Text style={[styles.dayNumber, date === today && styles.todayText]}>{Number(date.slice(8))}</Text>
              {mark && (
                <View style={styles.markRow}>
                  <View style={[styles.markDot, { backgroundColor: mark.color }]} />
                  {mark.star && <Text style={styles.star}>⭐</Text>}
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              {main && (
                <View>
                  <Text style={[styles.mainTitle, main.deload && { color: DELOAD_BLUE }]} numberOfLines={1}>
                    {main.deload ? "🌙 Deload · " : "🏋️ "}
                    {main.title}
                  </Text>
                  {main.parts ? <Text style={styles.parts}>{main.parts}</Text> : null}
                  {/* The client's abs and extra cardio, on the trainer's calendar (GRIZZ, 2026-10-22). */}
                  {main.addOns ? <Text style={styles.addOns}>{main.addOns}</Text> : null}
                </View>
              )}
              {/* A live session with the coach, in the day's slot (GRIZZ, 2026-10-27). */}
              {mark?.live && (
                <Text style={[styles.tag, { color: "#22C55E" }]} numberOfLines={1}>
                  {client ? "🤝 Live with your coach · tap to see" : "🤝 Live session with you"}
                </Text>
              )}
              {move ? (
                <Text style={[styles.moved, { color: move === "missed" ? "#EF4444" : "#22C55E" }]}>
                  {move === "missed" ? "Moved to the weekend" : "Caught up today"}
                </Text>
              ) : null}
              {plan.extras.map((x, j) => (
                <Text key={`x${j}`} style={[styles.tag, { color: x.functional ? FUNCTIONAL_TEAL : BRAND_GOLD }]} numberOfLines={1}>
                  {x.functional ? "🤸" : "➕"} {x.title}
                </Text>
              ))}
              {stab.map((s) => (
                <Text key={`s${s.programId}`} style={[styles.tag, { color: STABILITY_PURPLE }]} numberOfLines={1}>
                  {s.done ? "✓" : "🧘"} {s.label} stability
                </Text>
              ))}
              {rec.map((r, j) => (
                <Text key={`r${j}`} style={[styles.tag, { color: RECOVERY_GREEN }]} numberOfLines={1}>
                  {r.done ? "✓" : "🌿"} {r.label}
                </Text>
              ))}
              {empty && <Text style={styles.rest}>{date < today ? "—" : "Rest"}</Text>}
            </View>
          </Pressable>
        );
      })}
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: BRAND_GOLD }]}>■ Training</Text>
        <Text style={[styles.legendItem, { color: FUNCTIONAL_TEAL }]}>■ Mobility</Text>
        <Text style={[styles.legendItem, { color: STABILITY_PURPLE }]}>■ Stability</Text>
        <Text style={[styles.legendItem, { color: RECOVERY_GREEN }]}>■ Recovery</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  arrow: { color: BRAND_GOLD, fontSize: 30, fontWeight: "700", paddingHorizontal: 10 },
  week: { color: "#fff", fontSize: 17, fontWeight: "800" },
  weekDates: { color: "#94A3B8", fontSize: 12, marginTop: 1 },
  day: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1E293B",
    minHeight: 58,
  },
  trainingDay: { backgroundColor: "#211C0D", borderColor: "#5C4D1A" },
  deloadDay: { backgroundColor: "#0F1E33", borderColor: "#1E40AF" },
  today: { borderColor: "#22C55E", borderWidth: 2 },
  selected: { borderColor: BRAND_GOLD, borderWidth: 2 },
  past: { opacity: 0.55 },
  dateCol: { width: 38, alignItems: "center" },
  weekday: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  dayNumber: { color: "#fff", fontSize: 20, fontWeight: "800" },
  todayText: { color: "#22C55E" },
  markRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  markDot: { width: 9, height: 9, borderRadius: 5 },
  star: { fontSize: 9 },
  mainTitle: { color: BRAND_GOLD, fontSize: 15, fontWeight: "800" },
  parts: { color: "#E2E8F0", fontSize: 13, marginTop: 1 },
  addOns: { color: "#FCD34D", fontSize: 12, marginTop: 2 },
  moved: { fontSize: 12, fontWeight: "800" },
  tag: { fontSize: 13, fontWeight: "700" },
  rest: { color: "#64748B", fontSize: 14, marginTop: 8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  legendItem: { fontSize: 11, fontWeight: "700" },
});
