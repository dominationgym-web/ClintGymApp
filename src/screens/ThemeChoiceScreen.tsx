import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markThemeChosen, setThemePreference, themedStyles, useThemePreference, type ThemePreference } from "@/lib/theme";
import { BRAND_GOLD } from "@/lib/brand";

// Light or dark, picked once straight after signing up (GRIZZ, 2026-11-04:
// "Some people don't like a dark app"). Shown to clients and trainers before
// anything else, and once to anyone who never changed it in Settings. Tapping a
// look switches the whole app at once, so they see it before pressing Continue.
export default function ThemeChoiceScreen() {
  const preference = useThemePreference();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>How do you like your app?</Text>
        <Text style={styles.hint}>Tap one to see it. You can change it any time in Settings.</Text>

        <View style={styles.row}>
          <Look value="dark" label="Dark" on={preference === "dark"} />
          <Look value="light" label="Light" on={preference === "light"} />
        </View>

        <Pressable
          style={[styles.phone, preference === "system" && styles.phoneOn]}
          onPress={() => setThemePreference("system")}
          accessibilityRole="button"
          accessibilityState={{ selected: preference === "system" }}
        >
          <Text style={[styles.phoneText, preference === "system" && styles.phoneTextOn]}>📱 Match my phone</Text>
        </Pressable>

        <Pressable style={styles.continue} onPress={() => markThemeChosen()} accessibilityRole="button">
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// A small picture of the app in that look. Its colours stay the same in both
// modes so the two cards always show the difference.
function Look({ value, label, on }: { value: ThemePreference; label: string; on: boolean }) {
  const dark = value === "dark";
  return (
    <Pressable
      style={[styles.look, on && styles.lookOn]}
      onPress={() => setThemePreference(value)}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
    >
      <View style={[styles.preview, dark ? styles.previewDark : styles.previewLight]}>
        <View style={[styles.bar, { backgroundColor: dark ? "#F8FAFC" : "#0F172A", width: "70%" }]} />
        <View style={[styles.bar, { backgroundColor: dark ? "#64748B" : "#94A3B8", width: "50%" }]} />
        <View style={[styles.card, dark ? styles.cardDark : styles.cardLight]} />
        <View style={[styles.button, { backgroundColor: BRAND_GOLD }]} />
      </View>
      <Text style={[styles.lookText, on && styles.lookTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(
  {
    screen: { flex: 1, backgroundColor: "#0F172A" },
    body: { flex: 1, justifyContent: "center", padding: 24, maxWidth: 480, width: "100%", alignSelf: "center" },
    title: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 6 },
    hint: { color: "#94A3B8", fontSize: 14, textAlign: "center", marginBottom: 24 },
    row: { flexDirection: "row", gap: 12, marginBottom: 12 },
    look: {
      flex: 1,
      alignItems: "center",
      padding: 10,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: "#334155",
      backgroundColor: "#1E293B",
    },
    lookOn: { borderColor: "#D4AF37" },
    preview: { width: "100%", aspectRatio: 0.8, borderRadius: 10, padding: 10, gap: 6, marginBottom: 8, borderWidth: 1 },
    previewDark: { backgroundColor: "#0F172A", borderColor: "#334155" },
    previewLight: { backgroundColor: "#EEF2F7", borderColor: "#CBD5E1" },
    bar: { height: 8, borderRadius: 4 },
    card: { flex: 1, borderRadius: 8, marginTop: 4 },
    cardDark: { backgroundColor: "#1E293B" },
    cardLight: { backgroundColor: "#FFFFFF" },
    button: { height: 14, borderRadius: 7 },
    lookText: { color: "#CBD5E1", fontSize: 16, fontWeight: "700" },
    lookTextOn: { color: "#D4AF37" },
    phone: {
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#334155",
      backgroundColor: "#1E293B",
      marginBottom: 24,
    },
    phoneOn: { borderColor: "#D4AF37" },
    phoneText: { color: "#CBD5E1", fontSize: 15, fontWeight: "600" },
    phoneTextOn: { color: "#D4AF37" },
    continue: { backgroundColor: "#D4AF37", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
    continueText: { color: "#0F172A", fontSize: 17, fontWeight: "800" },
  },
  ["previewDark", "previewLight", "cardDark", "cardLight"]
);
