import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TrainerAgreementContent from "@/screens/auth/TrainerAgreementContent";

type Props = {
  signedName: string;
  onChangeSignedName: (name: string) => void;
  agreed: boolean;
  onToggleAgreed: () => void;
};

// The trainer agreement link, the typed-name signature and the "I agree" box,
// shared by trainer signup and the sign-again screen.
export default function AgreementSignFields({ signedName, onChangeSignedName, agreed, onToggleAgreed }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setVisible(true)}>
        <Text style={styles.link}>Read the trainer agreement</Text>
      </Pressable>
      <Text style={styles.label}>Sign by typing your full name</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#64748B"
        autoCapitalize="words"
        value={signedName}
        onChangeText={onChangeSignedName}
      />
      <Pressable style={styles.row} onPress={onToggleAgreed}>
        <View style={[styles.checkbox, agreed && styles.checkboxChecked]} />
        <Text style={styles.consent}>
          I have read and agree to the trainer agreement, including looking after my clients' personal information
          under POPIA.
        </Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Trainer agreement</Text>
            <Pressable onPress={() => setVisible(false)}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TrainerAgreementContent />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: "#22C55E", fontSize: 14, fontWeight: "600", marginVertical: 12, textDecorationLine: "underline" },
  label: { color: "#94A3B8", fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#64748B", marginTop: 1 },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  consent: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, flex: 1 },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  close: { color: "#22C55E", fontWeight: "600", fontSize: 15 },
});
