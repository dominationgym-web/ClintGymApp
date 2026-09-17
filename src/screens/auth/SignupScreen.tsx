import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import type { PlanType } from "@/types/database";
import PasswordInput from "@/components/PasswordInput";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

const PLANS: { key: PlanType; label: string }[] = [
  { key: "intro_1mo", label: "1-month intro (once-off)" },
  { key: "sub_6mo", label: "6-month subscription" },
  { key: "sub_12mo", label: "12-month subscription (best rate)" },
];

const PRIVACY_POLICY_VERSION = "2026-09-14";

export default function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<PlanType>("intro_1mo");
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("Missing details", "Fill in your name, email, and a password.");
      return;
    }
    if (!consented) {
      Alert.alert(
        "Consent required",
        "You need to accept the privacy policy and consent to data processing before creating an account."
      );
      return;
    }

    const trainerId = process.env.EXPO_PUBLIC_DEFAULT_TRAINER_ID;
    if (!trainerId) {
      Alert.alert("Setup error", "No trainer configured for signup. Contact your trainer.");
      return;
    }

    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Couldn't sign up", authError?.message ?? "Unknown error");
      return;
    }

    // access_status defaults to 'expired' at the database level and cannot
    // be set to anything else from here - see the "client inserts own
    // signup row" RLS policy in supabase/migrations/0001_init.sql. The
    // trainer flips it to 'active' after confirming EFT/PayPal payment.
    const { error: clientError } = await supabase.from("clients").insert({
      id: authData.user.id,
      trainer_id: trainerId,
      name,
      email,
      phone: phone || null,
      plan_type: plan,
      consent_accepted_at: new Date().toISOString(),
      privacy_policy_version: PRIVACY_POLICY_VERSION,
    });
    setLoading(false);

    if (clientError) {
      Alert.alert("Couldn't finish signup", clientError.message);
      return;
    }

    setAwaitingPayment(true);
  };

  if (awaitingPayment) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>One last step</Text>
        <Text style={styles.body}>
          Your account is created but not active yet. Pay for your plan using the details below,
          then let your trainer know - they'll confirm payment and switch on your access
          personally.
        </Text>
        <Text style={styles.sectionHeading}>South Africa - EFT</Text>
        <Text style={styles.body}>Bank details will be sent to you directly by your trainer.</Text>
        <Text style={styles.sectionHeading}>International - PayPal</Text>
        <Text style={styles.body}>PayPal details will be sent to you directly by your trainer.</Text>
        <Pressable style={styles.button} onPress={() => navigation.replace("Login")}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="Phone (optional)" value={phone} onChangeText={setPhone} />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />

      <Text style={styles.sectionHeading}>Choose your plan</Text>
      {PLANS.map((p) => (
        <Pressable key={p.key} style={styles.planRow} onPress={() => setPlan(p.key)}>
          <View style={[styles.radio, plan === p.key && styles.radioSelected]} />
          <Text style={styles.body}>{p.label}</Text>
        </Pressable>
      ))}

      <Pressable style={styles.planRow} onPress={() => setConsented((c) => !c)}>
        <View style={[styles.checkbox, consented && styles.checkboxChecked]} />
        <Text style={styles.consentText}>
          I consent to my health-related data (sleep, alcohol, training videos, check-ins) being
          processed by my trainer in line with the privacy policy, per POPIA.
        </Text>
      </Pressable>

      <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Continue to payment</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#0F172A" },
  title: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 16 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, flexShrink: 1 },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  planRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#64748B" },
  radioSelected: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#64748B" },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  consentText: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, flex: 1 },
  button: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  link: { color: "#94A3B8", textAlign: "center", marginTop: 20, marginBottom: 20 },
});
