import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText, themedStyles } from "@/lib/theme";
import { ScrollView } from "@/components/ScrollView";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

// "Forgot your password?" from the log-in page (GRIZZ, 2026-11-09). One tap
// sends their trainer a phone alert (0204); the trainer makes a new password
// under the client's 🔑 Log-in help and WhatsApps it. Trainers' alerts go to
// the Daily Evolution owner. The app has no email sending yet.
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const coach = route.params?.coach === true;
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const helper = coach ? "the Daily Evolution team" : "your trainer";

  const send = async () => {
    const typed = email.trim().toLowerCase();
    if (!typed.includes("@")) {
      Alert.alert("Your email", "Type the email you signed up with.");
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc("request_login_help", { p_email: typed });
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send it", "Check your internet connection and try again.");
      return;
    }
    setSent(true);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Forgot your password?</Text>
      {sent ? (
        <>
          <Text style={styles.done}>✓ Sent</Text>
          <Text style={styles.body}>
            We've told {helper}. They'll WhatsApp you a new password soon. Then log in with it, and pick your own password under Profile › Account.
          </Text>
          <Text style={styles.small}>Not heard back? Send {coach ? "us" : "your trainer"} a WhatsApp.</Text>
        </>
      ) : (
        <>
          <Text style={styles.body}>Type the email you signed up with and tap the button. {coach ? "We" : "Your trainer"} will get a message on {coach ? "our" : "their"} phone straight away.</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholderTextColor="#94A3B8"
            style={styles.input}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable style={styles.button} onPress={send} disabled={sending} accessibilityRole="button">
            {sending ? (
              <ActivityIndicator color={themeText("#0F172A")} />
            ) : (
              <Text style={styles.buttonText}>{coach ? "Ask for a new password" : "Ask my trainer for a new password"}</Text>
            )}
          </Pressable>
          <Text style={styles.small}>Not sure which email you used? Type your best guess. We'll still find you.</Text>
        </>
      )}
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button">
        <Text style={styles.link}>Back to log in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, maxWidth: 440, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 14 },
  body: { color: "#CBD5E1", fontSize: 16, lineHeight: 23, marginBottom: 16 },
  done: { color: "#22C55E", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  label: { color: "#CBD5E1", fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 14, marginBottom: 12 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  small: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 12 },
  link: { color: "#94A3B8", textAlign: "center", marginTop: 24, fontWeight: "600" },
});
