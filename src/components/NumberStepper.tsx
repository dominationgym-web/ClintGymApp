import React from "react";
import { Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import Pressable from "@/components/Pressable";
import { themedStyles, themeText } from "@/lib/theme";
import { tick } from "@/lib/haptics";

// A number with big − and + buttons either side (GRIZZ, 2026-11-21: log a set
// without typing). The number can still be tapped and typed for odd amounts.
export default function NumberStepper({
  value,
  onChange,
  step,
  min = 0,
  start,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  step: number;
  min?: number;
  /** What − or + gives when the box is empty, e.g. the target reps. */
  start?: number;
  placeholder?: string;
  accessibilityLabel: string;
}) {
  const bump = (dir: 1 | -1) => {
    const n = Number(String(value).replace(",", "."));
    tick();
    if (value === "" || Number.isNaN(n)) {
      onChange(String(start ?? min + step));
      return;
    }
    const next = Math.max(min, Math.round((n + dir * step) * 100) / 100);
    onChange(String(next));
  };
  return (
    <View style={styles.row}>
      <Pressable style={styles.btn} onPress={() => bump(-1)} accessibilityRole="button" accessibilityLabel={`Less ${accessibilityLabel}`} hitSlop={4}>
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={themeText("#64748B")}
        accessibilityLabel={accessibilityLabel}
        selectTextOnFocus
      />
      <Pressable style={styles.btn} onPress={() => bump(1)} accessibilityRole="button" accessibilityLabel={`More ${accessibilityLabel}`} hitSlop={4}>
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { width: 40, height: 48, borderRadius: 10, backgroundColor: "#273449", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 24, fontWeight: "700", lineHeight: 28 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
