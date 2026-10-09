import React from "react";
import { Alert, Clipboard, Pressable, StyleSheet, Text, View } from "react-native";
import { eftRows } from "@/lib/trainers";
import type { EftDetails } from "@/types/database";

type Props = {
  eftDetails: EftDetails | null | undefined;
  popWhatsapp: string | null | undefined;
};

// A trainer's own EFT details and proof-of-payment number (0029), each row
// tap-to-copy. Shown after client signup and on the client's Profile.
export default function TrainerPaymentDetails({ eftDetails, popWhatsapp }: Props) {
  const rows = eftRows(eftDetails);

  const copy = async (value: string, label: string) => {
    try {
      await Clipboard.setString(value);
      Alert.alert("Copied", `${label} copied to clipboard.`);
    } catch {
      Alert.alert("Error", "Failed to copy to clipboard.");
    }
  };

  if (rows.length === 0) {
    return <Text style={styles.body}>Your trainer will send you their payment details directly.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionHeading}>South Africa - EFT</Text>
      <View style={styles.bankBox}>
        {rows.map(({ label, value }) => (
          <Pressable
            key={label}
            style={styles.bankRow}
            onPress={() => copy(value, label)}
            android_ripple={{ color: "rgba(34, 197, 94, 0.1)" }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bankLabel}>{label}</Text>
              <Text style={styles.bankValue}>{value}</Text>
            </View>
            <Text style={styles.copyIcon}>📋</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.body}>
        Use your name as the payment reference so your trainer can match it to your account.
      </Text>
      {popWhatsapp ? (
        <Text style={styles.body}>
          Then send proof of payment to <Text style={styles.inline}>{popWhatsapp}</Text> on WhatsApp.
        </Text>
      ) : (
        <Text style={styles.body}>Then send your trainer proof of payment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, flexShrink: 1, marginBottom: 4 },
  bankBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 12 },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  bankLabel: { color: "#64748B", fontSize: 13, flexShrink: 0 },
  bankValue: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "right", flexShrink: 1 },
  copyIcon: { fontSize: 16, paddingLeft: 8 },
  inline: { color: "#22C55E", fontWeight: "700" },
});
