import React from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { KIND_STYLE, dayKey, monthGrid, monthLabel, sessionKind, shiftMonth, slotGroups } from "@/lib/liveSessions";
import type { LiveSession } from "@/types/database";
import { themeBg, themedStyles } from "@/lib/theme";

const HEAD = ["M", "T", "W", "T", "F", "S", "S"];

// A month of in-person sessions (0168): one coloured dot per session on its
// day (red late, green in time, gold done ...). Tap a day to see it. A group
// (two or more people at the same time) is one session, so one dot.
export default function SessionMonthCalendar({
  month,
  onMonth,
  sessions,
  selected,
  onSelect,
}: {
  month: string;
  onMonth: (month: string) => void;
  sessions: LiveSession[];
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  const now = new Date();
  const today = dayKey(now);
  const byDay = new Map<string, LiveSession[]>();
  for (const s of sessions) {
    if (s.status === "removed") continue;
    const k = dayKey(s.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => onMonth(shiftMonth(month, -1))} hitSlop={12} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{monthLabel(month)}</Text>
        <Pressable onPress={() => onMonth(shiftMonth(month, 1))} hitSlop={12} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {HEAD.map((h, i) => (
          <Text key={i} style={styles.head}>
            {h}
          </Text>
        ))}
      </View>
      {monthGrid(month).map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const list = slotGroups(byDay.get(day) ?? []).map((g) => g[0]);
            return (
              <Pressable
                key={di}
                style={[styles.cell, styles.day, day === today && styles.today, day === selected && styles.selected]}
                onPress={() => onSelect(day)}
              >
                <Text style={[styles.num, day === selected && styles.numSelected]}>{Number(day.slice(8))}</Text>
                <View style={styles.dots}>
                  {list.slice(0, 4).map((s) => (
                    <View key={s.id} style={[styles.dot, { backgroundColor: themeBg(KIND_STYLE[sessionKind(s, now)].colour) }]} />
                  ))}
                </View>
                {list.length > 4 ? <Text style={styles.more}>+{list.length - 4}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4 },
  arrowText: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row" },
  head: { flex: 1, textAlign: "center", color: "#64748B", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  day: { backgroundColor: "#1E293B", borderRadius: 8, alignItems: "center", paddingTop: 4, borderWidth: 1, borderColor: "#1E293B" },
  today: { borderColor: "#64748B" },
  selected: { borderColor: BRAND_GOLD, borderWidth: 2 },
  num: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  numSelected: { color: BRAND_GOLD },
  dots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 2, marginTop: 3, paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  more: { color: "#94A3B8", fontSize: 9 },
});
