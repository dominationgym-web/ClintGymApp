import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { BRAND_GOLD } from "@/lib/brand";
import { findArea, PAIN_RULE, stabilityAreasFor } from "@/lib/stability";
import { themedStyles } from "@/lib/theme";

// When a client reports an injury or pain (check-in or intake), point the
// trainer to the matching rehab programs (GRIZZ, 2026-10-16). Trainers can't
// diagnose or treat injuries, so the red-flag check comes first (review
// 2026-10-18).
export default function RehabSuggestion({ clientName, texts }: { clientName: string; texts: (string | null | undefined)[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const areas = stabilityAreasFor(...texts);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🛡️ Recovery, mobility and rehab</Text>
      <Text style={styles.flags}>
        First check for red flags: pain at night or at rest, numbness or tingling, swelling, pain after a fall or accident, pain above about 7 out of 10, fever or feeling unwell, or pain that isn't improving after 2 weeks. Any of these, a fresh injury (the last 1-2 weeks) or anything after surgery: {clientName} sees a doctor, physio or biokineticist first.
      </Text>
      <Text style={styles.text}>
        {areas.length
          ? `None of those? Read the rehab programs for this area, then give ${clientName} one on their Training tab under 🛡️ Stability programs. Rehab is the level for a niggle that still hurts.`
          : `None of those? Find the right area in Stability & Rehab programming, then give ${clientName} a program on their Training tab. Rehab is the level for a niggle that still hurts.`}
      </Text>
      {(areas.length ? areas : [undefined]).map((area) => (
        <Pressable key={area ?? "all"} style={styles.button} onPress={() => navigation.navigate("Stability", area ? { area } : undefined)} accessibilityRole="button">
          <Text style={styles.buttonText}>{area ? `${findArea(area).icon} Open ${findArea(area).title} rehab programs ›` : "Open Stability & Rehab programming ›"}</Text>
        </Pressable>
      ))}
      <Text style={styles.hint}>Pain rule: {PAIN_RULE}</Text>
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, margin: 6, marginTop: 2, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD },
  title: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14 },
  text: { color: "#E2E8F0", fontSize: 13, marginTop: 4, lineHeight: 18 },
  button: { backgroundColor: "#1E293B", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10, marginTop: 8 },
  buttonText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  flags: { color: "#FCA5A5", fontSize: 13, marginTop: 4, lineHeight: 18 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 8 },
});
