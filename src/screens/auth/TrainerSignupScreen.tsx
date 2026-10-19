import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import TextInput from "@/components/TextInput";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { retryIfIssuedInFuture } from "@/lib/clockSkew";
import { useAuth } from "@/context/AuthContext";
import PasswordInput from "@/components/PasswordInput";
import AgreementSignFields from "@/components/AgreementSignFields";
import { TRAINER_AGREEMENT_VERSION } from "@/screens/auth/TrainerAgreementContent";
import { isValidSignature } from "@/lib/trainers";
import { countryCheckMessage, phoneCountry } from "@/lib/phoneCountry";

type Props = NativeStackScreenProps<AuthStackParamList, "TrainerSignup">;

// A trainer applies to coach their own clients on the app. The database starts
// every new trainer unapproved (0029), so after this they see a waiting screen
// until the app owner approves them.
export default function TrainerSignupScreen({ navigation }: Props) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // Another trainer's code (0060), so they get a referral reward.
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Missing details", "Fill in your name, email, and a password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters long.");
      return;
    }

    if (!isValidSignature(signedName) || !agreed) {
      Alert.alert(
        "Sign the trainer agreement",
        "Read the trainer agreement, type your full name to sign it, and tick the box to agree."
      );
      return;
    }

    setLoading(true);
    // Location must be on: the country sets rand or dollar pricing (0096).
    // Builds without the location module can still apply; the owner then
    // picks their currency.
    const check = await phoneCountry();
    if (!check.ok && check.reason !== "unavailable") {
      setLoading(false);
      const { title, message } = countryCheckMessage(check.reason);
      Alert.alert(title, message);
      return;
    }
    let { data: authData, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (authError && /already registered/i.test(authError.message)) {
      // An earlier try made the login but dropped before the trainer details
      // were saved (GRIZZ, 2026-10-16: a tester's application never arrived).
      // With the same password, sign them in and finish it, as client signup does.
      const retry = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!retry.error && retry.data.user) {
        const userId = retry.data.user.id;
        const [{ data: trainerRow }, { data: clientRow }] = await Promise.all([
          retryIfIssuedInFuture(() => supabase.from("trainers").select("id").eq("id", userId).maybeSingle()),
          retryIfIssuedInFuture(() => supabase.from("clients").select("id").eq("id", userId).maybeSingle()),
        ]);
        if (trainerRow || clientRow) {
          await supabase.auth.signOut();
          setLoading(false);
          Alert.alert("Already signed up", `This email already has a ${trainerRow ? "trainer" : "client"} account. Log in instead.`);
          return;
        }
        authData = { user: retry.data.user, session: retry.data.session };
        authError = null;
      }
    }
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Couldn't sign up", authError?.message ?? "Unknown error");
      return;
    }

    // A brand-new login can briefly be refused as "issued at future";
    // retryIfIssuedInFuture waits that out (see src/lib/clockSkew.ts).
    const userId = authData.user.id;
    const { error } = await retryIfIssuedInFuture(() =>
      supabase.from("trainers").insert({
        id: userId,
        name: name.trim(),
        email: email.trim(),
        business_name: businessName.trim() || null,
        phone: phone.trim() || null,
        agreement_version: TRAINER_AGREEMENT_VERSION,
        agreement_signed_name: signedName.trim(),
        referred_by_code: referralCode.trim() || null,
        signup_country: check.ok ? check.country : null,
      })
    );
    if (error) {
      setLoading(false);
      Alert.alert("Couldn't finish signup", error.message);
      return;
    }
    // Swaps this screen for the waiting-for-approval screen.
    await refreshProfile();
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Coach on Daily Evolution</Text>
      <Text style={styles.body}>
        Sign up as a trainer to run your own clients on the app. Your account is checked and approved before
        clients can join you, and then you get a free 2-week trial.
      </Text>
      <Text style={styles.body}>
        📍 Please have your location on. We check your country once so you're charged the right prices. Only your
        country is saved.
      </Text>
      <Text style={styles.label}>Name and surname</Text>
      <TextInput placeholderTextColor="#94A3B8" style={styles.input} placeholder="e.g. Thabo Mokoena" autoCapitalize="words" value={name} onChangeText={setName} />
      <Text style={styles.label}>Business name (optional)</Text>
      <TextInput placeholderTextColor="#94A3B8"
        style={styles.input}
        placeholder="e.g. Daily Evolution"
        value={businessName}
        onChangeText={setBusinessName}
      />
      <Text style={styles.label}>Email</Text>
      <TextInput placeholderTextColor="#94A3B8"
        style={styles.input}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Phone number (optional)</Text>
      <TextInput placeholderTextColor="#94A3B8"
        style={styles.input}
        placeholder="e.g. 082 123 4567"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Text style={styles.label}>Password</Text>
      <PasswordInput placeholder="Choose a password" value={password} onChangeText={setPassword} />
      <Text style={styles.label}>Referral code from another trainer (optional)</Text>
      <TextInput placeholderTextColor="#94A3B8"
        style={styles.input}
        placeholder="Leave empty if you don't have one"
        autoCapitalize="characters"
        autoCorrect={false}
        value={referralCode}
        onChangeText={setReferralCode}
      />
      <AgreementSignFields
        signedName={signedName}
        onChangeSignedName={setSignedName}
        agreed={agreed}
        onToggleAgreed={() => setAgreed((a) => !a)}
      />
      <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Apply as a trainer</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login", { coach: true })}>
        <Text style={styles.link}>Already a coach? Log in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: "#CBD5E1", fontWeight: "600", marginBottom: 6 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#0F172A" },
  title: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 12 },
  body: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 14, marginBottom: 12 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  link: { color: "#94A3B8", textAlign: "center", marginTop: 20, marginBottom: 20 },
});
