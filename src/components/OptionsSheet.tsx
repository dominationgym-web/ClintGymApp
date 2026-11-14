import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";
import SafeBottom from "@/components/SafeBottom";

export type SheetOption = { label: string; detail?: string; danger?: boolean; onPress: () => void };

// Hold something and its options pop up from the bottom (GRIZZ, 2026-11-14:
// "hold the program, then an option banner pops up to edit, move, remove",
// instead of hunting for the right button). Any number of options, which a
// plain Android alert can't do (it shows 3 buttons at most).
export default function OptionsSheet({
  title,
  subtitle,
  options,
  onClose,
}: {
  // null hides the sheet.
  title: string | null;
  subtitle?: string;
  options: SheetOption[];
  onClose: () => void;
}) {
  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {options.map((o) => (
            <Pressable
              key={o.label}
              style={styles.option}
              onPress={() => {
                onClose();
                o.onPress();
              }}
            >
              <Text style={[styles.optionText, o.danger && styles.danger]}>{o.label}</Text>
              {o.detail ? <Text style={styles.detail}>{o.detail}</Text> : null}
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <SafeBottom />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderWidth: 1, borderColor: "#334155" },
  title: { color: "#fff", fontWeight: "900", fontSize: 18 },
  subtitle: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  option: { backgroundColor: "#1E293B", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, marginTop: 10 },
  optionText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 16 },
  danger: { color: "#F87171" },
  detail: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  cancel: { paddingVertical: 14, alignItems: "center", marginTop: 6 },
  cancelText: { color: "#CBD5E1", fontWeight: "700", fontSize: 15 },
});
