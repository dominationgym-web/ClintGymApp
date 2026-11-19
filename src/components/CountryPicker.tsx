import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "@/components/ModalSafeArea";
import { BRAND_GOLD } from "@/lib/brand";
import { COMMON_COUNTRIES, countriesStartingWith, countryFlag, countryLabel, countryLetters, countryName } from "@/lib/countries";
import { themedStyles } from "@/lib/theme";

// "Where do you live?" at client sign-up (GRIZZ 2026-11-19, 0231). Tap only:
// common countries as buttons, every other one behind "Another country",
// picked by first letter so there's no long list to scroll.
export default function CountryPicker({ value, onPick }: { value: string | null; onPick: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const other = value && !COMMON_COUNTRIES.includes(value);

  const close = () => {
    setOpen(false);
    setLetter(null);
  };

  return (
    <View>
      <View style={styles.chips}>
        {COMMON_COUNTRIES.map((code) => {
          const on = code === value;
          return (
            <Pressable key={code} style={[styles.chip, on && styles.chipOn]} onPress={() => onPick(code)} accessibilityRole="button">
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {countryFlag(code)} {countryName(code)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.chip, other && styles.chipOn]} onPress={() => setOpen(true)} accessibilityRole="button">
          <Text style={[styles.chipText, other && styles.chipTextOn]}>{other ? `${countryLabel(value)} ›` : "Another country ›"}</Text>
        </Pressable>
      </View>

      <Modal visible={open} animationType="slide" onRequestClose={() => (letter ? setLetter(null) : close())}>
        <ModalSafeArea style={styles.modal}>
          <View style={styles.header}>
            <Pressable onPress={() => (letter ? setLetter(null) : close())} hitSlop={10} accessibilityRole="button">
              <Text style={styles.headerLink}>{letter ? "‹ Letters" : "Close"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{letter ? `Countries starting with ${letter}` : "Tap the first letter"}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {!letter ? (
              <View style={styles.letters}>
                {countryLetters().map((l) => (
                  <Pressable key={l} style={styles.letter} onPress={() => setLetter(l)} accessibilityRole="button">
                    <Text style={styles.letterText}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              countriesStartingWith(letter).map(([code, name]) => (
                <Pressable
                  key={code}
                  style={[styles.row, code === value && styles.rowOn]}
                  onPress={() => {
                    onPick(code);
                    close();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.rowText, code === value && styles.chipTextOn]}>
                    {countryFlag(code)} {name}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    </View>
  );
}

const styles = themedStyles({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 18, paddingVertical: 7, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20 },
  headerLink: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 17, flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 30 },
  letters: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  letter: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  letterText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  row: { backgroundColor: "#1E293B", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8 },
  rowOn: { backgroundColor: BRAND_GOLD },
  rowText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
