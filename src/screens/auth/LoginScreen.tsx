import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Image, Platform } from "react-native";
import TextInput from "@/components/TextInput";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";
import { themeText, themedStyles } from "@/lib/theme";
import { BRAND_GOLD } from "@/lib/brand";
import { loadLoginBrand, type TrainerBrand } from "@/hooks/useTrainerBrand";
import { ScrollView } from "@/components/ScrollView";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation, route }: Props) {
  const coach = route.params?.coach === true;
  const [emailText, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // The trainer's logo from the last log-in on this phone (GRIZZ, 2026-11-04); the DE logo until then.
  const [brand, setBrand] = useState<TrainerBrand | null>(null);
  useEffect(() => {
    loadLoginBrand().then(setBrand);
  }, []);

  // The website's "Start your free trial" button opens /app/?signup=trainer,
  // which goes straight to the trainer application (For Personal Trainers page).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("signup") === "trainer") navigation.navigate("TrainerSignup");
  }, [navigation]);

  const handleLogin = async () => {
    // Phone autofill often adds a space at the end; Supabase stores emails in lower case.
    const email = emailText.trim().toLowerCase();
    if (!email || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      // Supabase says "Invalid login credentials": say it plainly and point to help.
      if (/invalid login credentials/i.test(error.message)) {
        Alert.alert("Couldn't log in", "The email or password is wrong. Check the spelling, or tap \"Forgot your password?\" for help.");
      } else Alert.alert("Couldn't sign in", error.message);
      return;
    }
    // A login with no client or trainer details means sign-up was cut off
    // before it finished. Say so, instead of leaving them on this page.
    const userId = data.user?.id;
    if (userId) {
      const [{ data: t, error: te }, { data: c, error: ce }] = await Promise.all([
        supabase.from("trainers").select("id").eq("id", userId).maybeSingle(),
        supabase.from("clients").select("id").eq("id", userId).maybeSingle(),
      ]);
      if (!te && !ce && !t && !c) {
        await supabase.auth.signOut();
        Alert.alert(
          "Finish signing up",
          "Your sign-up didn't finish last time. Clients: tap \"Sign up\". Trainers: tap \"Trainer log in\", then \"New trainer? Apply\". Use the same email and password."
        );
      }
    }
    setLoading(false);
  };

  // Logo, one gold Log in button and a clear Sign up button (critique, 2026-11-04).
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {brand?.logoUrl ? (
        <>
          <Image source={{ uri: brand.logoUrl }} style={[styles.logo, styles.trainerLogo]} resizeMode="cover" accessibilityLabel={brand.name} />
          <Text style={styles.brandName}>{brand.name}</Text>
        </>
      ) : (
        <Image source={require("../../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="Daily Evolution" />
      )}
      <Text style={styles.title}>{coach ? "Trainer log in" : "Log in"}</Text>
      <Text style={styles.label}>Email</Text>
      <TextInput placeholderTextColor="#94A3B8"
        style={styles.input}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={emailText}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Password</Text>
      <PasswordInput placeholder="Your password" value={password} onChangeText={setPassword} />
      <Pressable onPress={() => navigation.navigate("ForgotPassword", { coach })} hitSlop={8} style={styles.forgot} accessibilityRole="button">
        <Text style={styles.forgotText}>Forgot your password?</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={handleLogin} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Log in</Text>}
      </Pressable>
      {coach ? (
        <>
          <Pressable style={styles.outline} onPress={() => navigation.navigate("TrainerSignup")} accessibilityRole="button">
            <Text style={styles.outlineText}>New trainer? Apply</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.link}>Back to client log in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable style={styles.outline} onPress={() => navigation.navigate("Signup")} accessibilityRole="button">
            <Text style={styles.outlineText}>New client? Sign up</Text>
          </Pressable>
          <Pressable onPress={() => navigation.push("Login", { coach: true })} hitSlop={8}>
            <Text style={styles.link}>Trainer log in</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, maxWidth: 440, width: "100%", alignSelf: "center" },
  logo: { width: 150, height: 150, alignSelf: "center", marginBottom: 20 },
  trainerLogo: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  brandName: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 20 },
  label: { color: "#CBD5E1", fontWeight: "600", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 20 },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: BRAND_GOLD,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  outline: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 10, padding: 13, alignItems: "center", marginTop: 12 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 16 },
  link: { color: "#94A3B8", textAlign: "center", marginTop: 20, fontWeight: "600" },
  forgot: { alignSelf: "flex-end", marginTop: 8 },
  forgotText: { color: BRAND_GOLD, fontWeight: "600" },
});
