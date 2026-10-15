import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { isValidSignature } from "@/lib/trainers";
import AgreementSignFields from "@/components/AgreementSignFields";
import TrainerAgreementContent, { TRAINER_AGREEMENT_VERSION } from "@/screens/auth/TrainerAgreementContent";

// Shown instead of the app to a trainer who hasn't signed the current trainer
// agreement (0031): one who signed an older version, or who signed up before
// the agreement existed.
export default function TrainerAgreementScreen() {
  const { trainer, refreshProfile, signOut } = useAuth();
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!trainer) return null;

  const sign = async () => {
    if (!isValidSignature(signedName) || !agreed) {
      Alert.alert("Sign the agreement", "Type your full name to sign, and tick the box to agree.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("trainers")
      .update({ agreement_version: TRAINER_AGREEMENT_VERSION, agreement_signed_name: signedName.trim() })
      .eq("id", trainer.id);
    if (error) {
      setSaving(false);
      Alert.alert("Couldn't save your signature", error.message);
      return;
    }
    await refreshProfile();
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 40 }}>
      <Text style={styles.title}>Trainer agreement</Text>
      <Text style={styles.intro}>
        {trainer.agreement_version
          ? "The trainer agreement has been updated. Please read and sign the new version to carry on."
          : "Please read and sign the trainer agreement to carry on."}
      </Text>
      <TrainerAgreementContent />
      <AgreementSignFields
        signedName={signedName}
        onChangeSignedName={setSignedName}
        agreed={agreed}
        onToggleAgreed={() => setAgreed((a) => !a)}
      />
      <Pressable style={styles.button} onPress={sign} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Sign agreement</Text>}
      </Pressable>
      <Pressable style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  intro: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  logout: { alignItems: "center", marginTop: 20 },
  logoutText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
});
