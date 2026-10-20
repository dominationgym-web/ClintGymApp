import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

// Serious symptoms on a check-in (0133): every workout is on hold until the
// trainer confirms a medical assessment or that it was tapped by mistake.
export const EMERGENCY_NUMBERS = [
  { label: "Ambulance 10177", tel: "10177" },
  { label: "From a cell phone 112", tel: "112" },
];

export default function MedicalHoldNotice({ live = false }: { live?: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🛑 Workouts on hold</Text>
      <Text style={styles.text}>
        {live
          ? "This client reported serious symptoms on their check-in. Don't train them. Clear the hold on their Overview once a doctor or other health professional has assessed them."
          : "You reported serious symptoms. Don't exercise until a doctor has checked you and your coach clears you."}
      </Text>
      {!live && <Text style={styles.text}>If the symptoms are happening now, or getting worse, call for help:</Text>}
      {!live && (
        <View style={styles.row}>
          {EMERGENCY_NUMBERS.map((n) => (
            <Pressable key={n.tel} style={styles.call} onPress={() => Linking.openURL(`tel:${n.tel}`)}>
              <Text style={styles.callText}>📞 {n.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#450A0A", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: "#EF4444" },
  title: { color: "#FCA5A5", fontSize: 18, fontWeight: "900" },
  text: { color: "#FEE2E2", fontSize: 15, lineHeight: 21, marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  call: { backgroundColor: "#EF4444", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  callText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
