import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PasswordInput from "@/components/PasswordInput";

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
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (authError || !authData.user) {
      setLoading(false);
      Alert.alert("Couldn't sign up", authError?.message ?? "Unknown error");
      return;
    }

    const { error } = await supabase.from("trainers").insert({
      id: authData.user.id,
      name: name.trim(),
      email: email.trim(),
      business_name: businessName.trim() || null,
      phone: phone.trim() || null,
    });
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
      <Text style={styles.title}>Coach on Consistent Change</Text>
      <Text style={styles.body}>
        Sign up as a trainer to run your own clients on the app. Your account is checked and approved before
        clients can join you.
      </Text>
      <TextInput style={styles.input} placeholder="Your full name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Business name (optional)"
        value={businessName}
        onChangeText={setBusinessName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (optional)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />
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
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#0F172A" },
  title: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 12 },
  body: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 14, marginBottom: 12 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  link: { color: "#94A3B8", textAlign: "center", marginTop: 20, marginBottom: 20 },
});
