import React from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { PIN_LENGTH } from "@/lib/appLockRules";
import { themedStyles } from "@/lib/theme";

// Big tap buttons for the app lock PIN: no keyboard, no typing (GRIZZ, 2026-11-08).
export default function PinPad({
  value,
  onChange,
  disabled,
  extraKey,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  // Bottom-left key, e.g. the fingerprint button on the lock screen.
  extraKey?: { label: string; onPress: () => void; accessibilityLabel: string } | null;
}) {
  const press = (digit: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    onChange(value + digit);
  };
  const back = () => {
    if (!disabled && value.length > 0) onChange(value.slice(0, -1));
  };
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];
  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotOn]} />
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((d) => (
            <Key key={d} label={d} onPress={() => press(d)} disabled={disabled} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        {extraKey ? (
          <Key label={extraKey.label} onPress={extraKey.onPress} small accessibilityLabel={extraKey.accessibilityLabel} />
        ) : (
          <View style={styles.keySpace} />
        )}
        <Key label="0" onPress={() => press("0")} disabled={disabled} />
        <Key label="⌫" onPress={back} disabled={disabled || value.length === 0} small accessibilityLabel="Delete" />
      </View>
    </View>
  );
}

function Key({
  label,
  onPress,
  disabled,
  small,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.key, pressed && !disabled && styles.keyPressed, disabled && styles.keyDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.keyText, small && styles.keyTextSmall]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  wrap: { alignItems: "center" },
  dots: { flexDirection: "row", gap: 18, marginBottom: 28 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#64748B" },
  dotOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  row: { flexDirection: "row", gap: 22, marginBottom: 16 },
  key: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: { backgroundColor: "#334155", borderColor: BRAND_GOLD },
  keyDisabled: { opacity: 0.4 },
  keySpace: { width: 74, height: 74 },
  keyText: { color: "#FFFFFF", fontSize: 28, fontWeight: "600" },
  keyTextSmall: { fontSize: 24 },
});
