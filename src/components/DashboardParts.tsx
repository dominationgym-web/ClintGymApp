import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";

// Building blocks for the client's laptop pages (GRIZZ, 2026-10-27): a page
// with its title and tabs along the top, cards, big numbers and bars.

export function DashPage({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageInner}>
      <View style={styles.top}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
  );
}

export function DashTabs<T extends string>({ tabs, on, onPick }: { tabs: { key: T; label: string }[]; on: T; onPick: (key: T) => void }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => onPick(t.key)} style={[styles.tab, on === t.key && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on === t.key }}>
          <Text style={[styles.tabText, on === t.key && styles.tabTextOn]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DashChips<T extends string | number>({ items, on, onPick }: { items: { key: T; label: string }[]; on: T | null; onPick: (key: T) => void }) {
  return (
    <View style={styles.chips}>
      {items.map((c) => (
        <Pressable key={String(c.key)} onPress={() => onPick(c.key)} style={[styles.chip, on === c.key && styles.chipOn]}>
          <Text style={[styles.chipText, on === c.key && styles.chipTextOn]}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.card, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.cardTitleRow}>
      <Text style={styles.cardTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Stat({ label, value, unit, note, noteColor, bar, barColor, valueColor, style }: {
  style?: StyleProp<ViewStyle>;
  label: string;
  value: string;
  unit?: string;
  note?: string;
  noteColor?: string;
  bar?: number | null;
  barColor?: string;
  valueColor?: string;
}) {
  return (
    <Card style={[styles.stat, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {bar != null ? <Bar fraction={bar} color={barColor} /> : null}
      {note ? <Text style={[styles.note, noteColor ? { color: noteColor } : null]}>{note}</Text> : null}
    </Card>
  );
}

export function Bar({ fraction, color = BRAND_GOLD }: { fraction: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Pill({ text, tone = "green" }: { text: string; tone?: "green" | "gold" | "grey" }) {
  return (
    <View style={[styles.pill, tone === "gold" && styles.pillGold, tone === "grey" && styles.pillGrey]}>
      <Text style={[styles.pillText, tone === "gold" && styles.pillTextGold, tone === "grey" && styles.pillTextGrey]}>{text}</Text>
    </View>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tip}>
      <Text style={styles.tipText}>💡 {text}</Text>
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={styles.muted}>{children}</Text>
    </View>
  );
}

/** A plain table: one row of cells per line, the first line as headings when `head` is set. */
export function Table({ head, rows, widths }: { head?: string[]; rows: React.ReactNode[][]; widths: number[] }) {
  const cell = (c: React.ReactNode, i: number, header = false) => (
    <View key={i} style={{ flex: widths[i] ?? 1, paddingRight: 6 }}>
      {typeof c === "string" || typeof c === "number" ? <Text style={header ? styles.th : styles.td}>{c}</Text> : c}
    </View>
  );
  return (
    <View>
      {head ? <View style={styles.tr}>{head.map((h, i) => cell(h, i, true))}</View> : null}
      {rows.map((r, ri) => (
        <View key={ri} style={styles.tr}>
          {r.map((c, i) => cell(c, i))}
        </View>
      ))}
    </View>
  );
}

// For a card in a column (Card fills its share of a Row by default).
export const natural: ViewStyle = { flexGrow: 0, flexShrink: 0, flexBasis: "auto" };

export const dash = {
  green: "#4ADE80",
  orange: "#F59E0B",
  blue: "#60A5FA",
  text: "#E2E8F0",
  muted: "#94A3B8",
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B1424" },
  pageInner: { padding: 24, gap: 16 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  subtitle: { color: dash.muted, fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tab: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9, backgroundColor: "#16223B" },
  tabOn: { backgroundColor: BRAND_GOLD },
  tabText: { color: "#CBD5E1", fontSize: 14, fontWeight: "600" },
  tabTextOn: { color: "#14110A" },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 8, backgroundColor: "#1B2846", borderWidth: 1, borderColor: "transparent" },
  chipOn: { backgroundColor: "#2A3A5F", borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  row: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  card: { flex: 1, backgroundColor: "#121E36", borderWidth: 1, borderColor: "#1F2D4B", borderRadius: 14, padding: 16 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", flexShrink: 1 },
  stat: { minWidth: 180 },
  label: { color: dash.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 },
  unit: { color: dash.muted, fontSize: 13, fontWeight: "600" },
  note: { color: dash.muted, fontSize: 12, marginTop: 4 },
  bar: { height: 10, backgroundColor: "#1C2A47", borderRadius: 6, overflow: "hidden", marginTop: 8 },
  barFill: { height: "100%", borderRadius: 6 },
  pill: { backgroundColor: "#163A26", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
  pillGold: { backgroundColor: "#3A3214" },
  pillGrey: { backgroundColor: "#1E293B" },
  pillText: { color: dash.green, fontSize: 12, fontWeight: "700" },
  pillTextGold: { color: "#E8C766" },
  pillTextGrey: { color: "#CBD5E1" },
  tip: { backgroundColor: "#3A3214", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  tipText: { color: "#F2DC8F", fontSize: 13, lineHeight: 19 },
  muted: { color: dash.muted, fontSize: 13, lineHeight: 19 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#1F2D4B" },
  th: { color: dash.muted, fontSize: 12, fontWeight: "600" },
  td: { color: dash.text, fontSize: 14 },
});
