import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import { BRAND_GOLD } from "@/lib/brand";
import { cardLabels, isTwoStep, type ProgramCard } from "@/lib/programCards";
import type { Program } from "@/types/database";
import { themeBorder, themedStyles } from "@/lib/theme";

export type ChipState = "used" | "current" | null;

// One version card (src/lib/programCards.ts): the set's name with a small
// button per version, sport or level. Tapping a button picks that program;
// whatever the screen shows for the picked program (details, its days, a
// "Put it on" button) goes under the buttons via `children`. Two-step cards
// (Drop sets, 12-week sport) show the second row once the first is tapped.
export default function ProgramCardView<P extends Program>({
  card,
  selectedId,
  onSelect,
  chipState,
  disabled,
  children,
}: {
  card: ProgramCard<P>;
  selectedId: string | null;
  onSelect: (program: P) => void;
  /** Marks a button as used (dimmed, can't tap) or as already on this day (✓). */
  chipState?: (program: P) => ChipState;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const selected = card.options.find((o) => o.program.id === selectedId) ?? null;
  const twoStep = isTwoStep(card);
  const [label, setLabel] = useState<string | null>(selected?.label ?? null);
  const selectedLabel = selected?.label ?? null;
  // Opens the right first-row button when a program of this card is picked elsewhere.
  useEffect(() => {
    if (selectedLabel) setLabel(selectedLabel);
  }, [selectedId, selectedLabel]);

  const single = card.options.length === 1;
  const only = card.options[0].program;
  if (single) {
    const state = chipState?.(only) ?? null;
    const isOn = selectedId === only.id;
    return (
      <View style={[styles.card, isOn && { borderColor: themeBorder(BRAND_GOLD) }, state === "used" && styles.used]}>
        <Pressable onPress={() => onSelect(only)} disabled={disabled || state === "used"}>
          <View style={styles.top}>
            <Text style={styles.icon}>{card.icon}</Text>
            <Text style={styles.title}>{card.title}</Text>
            {state === "used" && <Text style={styles.usedTag}>Used</Text>}
            {state === "current" && <Text style={styles.currentTag}>✓ On this day</Text>}
            <Text style={styles.chevron}>{isOn ? "▴" : "▾"}</Text>
          </View>
          {!isOn && only.description ? (
            <Text style={styles.hint} numberOfLines={1}>
              {only.description}
            </Text>
          ) : null}
        </Pressable>
        {isOn && children}
      </View>
    );
  }

  const chip = (key: string, text: string, on: boolean, onPress: () => void, state: ChipState = null) => (
    <Pressable
      key={key}
      style={[styles.chip, on && styles.chipOn, state === "used" && styles.chipUsed]}
      onPress={onPress}
      disabled={disabled || state === "used"}
      accessibilityState={{ selected: on, disabled: state === "used" }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn, state === "used" && styles.chipTextUsed]}>
        {state === "current" ? `✓ ${text}` : text}
      </Text>
    </Pressable>
  );

  const labels = cardLabels(card);
  const subs = twoStep && label ? card.options.filter((o) => o.label === label) : [];
  const count = card.options.length;

  return (
    <View style={[styles.card, selected && { borderColor: themeBorder(BRAND_GOLD) }]}>
      <View style={styles.top}>
        <Text style={styles.icon}>{card.icon}</Text>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.count}>{count}</Text>
      </View>
      {card.hint ? <Text style={styles.hint}>{card.hint}</Text> : null}
      <View style={styles.chips}>
        {twoStep
          ? labels.map((l) => chip(`l-${l}`, l, l === label, () => setLabel(l === label ? null : l)))
          : card.options.map((o) =>
              chip(o.program.id, o.label, o.program.id === selectedId, () => onSelect(o.program), chipState?.(o.program) ?? null),
            )}
      </View>
      {subs.length > 0 && (
        <View style={[styles.chips, styles.subRow]}>
          {subs.map((o) => chip(o.program.id, o.sub ?? o.label, o.program.id === selectedId, () => onSelect(o.program), chipState?.(o.program) ?? null))}
        </View>
      )}
      {selected && (
        <>
          <Text style={styles.picked}>{selected.program.name}</Text>
          {children}
        </>
      )}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#0B1220", borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "#1E293B" },
  used: { opacity: 0.6 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { fontSize: 18 },
  title: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1 },
  count: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  subRow: { borderTopWidth: 1, borderTopColor: "#1E293B", paddingTop: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 11, minWidth: 38, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipUsed: { borderColor: "#7F1D1D", backgroundColor: "#1F1315" },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  chipTextUsed: { color: "#F87171", textDecorationLine: "line-through" },
  usedTag: { color: "#F87171", fontWeight: "800", fontSize: 12 },
  currentTag: { color: BRAND_GOLD, fontWeight: "800", fontSize: 12 },
  picked: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14, marginTop: 10 },
});
