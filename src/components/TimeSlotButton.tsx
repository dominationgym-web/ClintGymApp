import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import SafeBottom from "@/components/SafeBottom";
import { BRAND_GOLD } from "@/lib/brand";
import { halfHourSlots } from "@/lib/mealPlanMaker";
import { themedStyles } from "@/lib/theme";

// One button per meal, snack or training time (GRIZZ, 2026-11-07: "Have a
// meal 1 button. Touch then time slots pop up with half hour breaks. Seeing
// all those slots makes it seem cluttered"). Tap it, pick a half hour, done.
export default function TimeSlotButton({
  label,
  value,
  onChange,
  after,
  extra,
}: {
  label: string;
  value: string | null;
  onChange: (time: string | null) => void;
  /** Only times after this one are offered (Meal 2 comes after Meal 1). */
  after?: string | null;
  /** One more choice above the times, such as "Doesn't train" (picks null). */
  extra?: string;
}) {
  const [open, setOpen] = useState(false);
  const all = halfHourSlots();
  const later = after ? all.filter((t) => t > after) : all;
  // A time typed in before (like 18:45) still shows as a choice.
  const slots = value && !later.includes(value) ? [...later, value].sort() : later;
  const pick = (time: string | null) => {
    setOpen(false);
    onChange(time);
  };

  return (
    <>
      <Pressable style={styles.button} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? extra ?? "pick a time"}`}>
        <Text style={styles.buttonLabel}>{label}</Text>
        <Text style={styles.buttonTime}>{value ?? extra ?? "Pick"} ›</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{label}</Text>
            <ScrollView style={{ flexShrink: 1 }}>
              {extra ? (
                <Pressable style={[styles.extra, value === null && styles.slotOn]} onPress={() => pick(null)}>
                  <Text style={[styles.slotText, value === null && styles.slotTextOn]}>{extra}</Text>
                </Pressable>
              ) : null}
              <View style={styles.grid}>
                {slots.map((t) => (
                  <Pressable key={t} style={[styles.slot, value === t && styles.slotOn]} onPress={() => pick(t)} accessibilityLabel={t}>
                    <Text style={[styles.slotText, value === t && styles.slotTextOn]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <SafeBottom />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = themedStyles({
  button: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  buttonLabel: { color: "#fff", fontWeight: "700" },
  buttonTime: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 24, maxHeight: "80%" },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { width: "23%", backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  extra: { backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 11, alignItems: "center", marginBottom: 8 },
  slotOn: { backgroundColor: BRAND_GOLD },
  slotText: { color: "#CBD5E1", fontWeight: "700", fontSize: 15 },
  slotTextOn: { color: "#0F172A" },
  cancel: { backgroundColor: "#334155", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  cancelText: { color: "#fff", fontWeight: "700" },
});
