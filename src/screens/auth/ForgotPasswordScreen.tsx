import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import TextInput from "@/components/TextInput";
import PasswordInput from "@/components/PasswordInput";
import { supabase } from "@/lib/supabase";
import { friendlyAlert, isNetworkError } from "@/lib/network";
import { cleanResetCode, passwordProblem, resetCodeProblem } from "@/lib/passwordRules";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText, themedStyles } from "@/lib/theme";
import { ScrollView } from "@/components/ScrollView";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

type Step = "start" | "code" | "asked";

const codeAlert = (title: string, error: { message?: string }): [string, string] =>
  isNetworkError(error) ? friendlyAlert(title, error) : [title, resetCodeProblem(error.message)];

// "Forgot your password?" from the log-in page. Since 2026-11-19 the main way
// is an emailed code: resetPasswordForEmail sends a 6-digit code (Supabase's
// recovery email goes out through Resend and its template shows {{ .Token }}),
// they type the code and a new password on one page, and verifyOtp (type
// recovery) + updateUser change it and log them in. Asking first for the new
// password matters: verifyOtp signs them in, which swaps the log-in screens
// for the app, so the password change has to be in the same tap.
// The trainer-led way from PR #327 stays as the backup: one tap sends their
// trainer a phone alert (0204), the trainer makes a new password under the
// client's 🔑 Log-in help and WhatsApps it. Trainers' alerts go to the owner.
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const coach = route.params?.coach === true;
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [step, setStep] = useState<Step>("start");
  const [busy, setBusy] = useState<null | "email" | "trainer" | "save">(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const helper = coach ? "the Daily Evolution team" : "your trainer";

  const typedEmail = () => {
    const typed = email.trim().toLowerCase();
    if (!typed.includes("@")) {
      Alert.alert("Your email", "Type the email you signed up with.");
      return null;
    }
    return typed;
  };

  const emailCode = async () => {
    const typed = typedEmail();
    if (!typed) return;
    setBusy("email");
    const { error } = await supabase.auth.resetPasswordForEmail(typed);
    setBusy(null);
    if (error) {
      Alert.alert(...codeAlert("Couldn't send the code", error));
      return;
    }
    setCode("");
    setStep("code");
  };

  const askTrainer = async () => {
    const typed = typedEmail();
    if (!typed) return;
    setBusy("trainer");
    const { error } = await supabase.rpc("request_login_help", { p_email: typed });
    setBusy(null);
    if (error) {
      Alert.alert(...friendlyAlert("Couldn't send it", error, "Check your internet connection and try again."));
      return;
    }
    setStep("asked");
  };

  const save = async () => {
    const token = cleanResetCode(code);
    if (token.length < 6) {
      Alert.alert("The code", "Type the code from the email we just sent you.");
      return;
    }
    const problem = passwordProblem(password, again);
    if (problem) {
      Alert.alert("Check your new password", problem);
      return;
    }
    setBusy("save");
    const verified = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "recovery" });
    if (verified.error) {
      setBusy(null);
      Alert.alert(...codeAlert("Couldn't check the code", verified.error));
      return;
    }
    // They're logged in now, so the app may already be taking over this screen.
    const changed = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (changed.error && !/different from the old/i.test(changed.error.message)) {
      Alert.alert(
        "You're logged in",
        "Your new password didn't save. Pick it again under Profile › Account › Change my password.",
      );
      return;
    }
    Alert.alert("Password changed", "You're logged in. Next time, log in with your new password.");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Forgot your password?</Text>
      {step === "asked" ? (
        <>
          <Text style={styles.done}>✓ Sent</Text>
          <Text style={styles.body}>
            We've told {helper}. They'll WhatsApp you a new password soon. Then log in with it, and pick your own password under Profile › Account.
          </Text>
          <Text style={styles.small}>Not heard back? Send {coach ? "us" : "your trainer"} a WhatsApp.</Text>
        </>
      ) : step === "code" ? (
        <>
          <Text style={styles.done}>✓ Code sent</Text>
          <Text style={styles.body}>
            We've emailed a code to {email.trim().toLowerCase()}. It can take a minute, so check your spam folder too.
          </Text>
          <Text style={styles.label}>Code from the email</Text>
          <TextInput
            placeholderTextColor="#94A3B8"
            style={[styles.input, styles.codeInput]}
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={12}
            value={code}
            onChangeText={(t) => setCode(cleanResetCode(t))}
          />
          <Text style={styles.label}>New password</Text>
          <PasswordInput placeholder="At least 8 letters or numbers" autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} />
          <Text style={styles.label}>New password again</Text>
          <PasswordInput placeholder="Same again" autoCapitalize="none" autoCorrect={false} value={again} onChangeText={setAgain} />
          <Pressable style={styles.button} onPress={save} disabled={busy !== null} accessibilityRole="button">
            {busy === "save" ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Change my password</Text>}
          </Pressable>
          <Pressable style={styles.secondButton} onPress={emailCode} disabled={busy !== null} accessibilityRole="button">
            {busy === "email" ? <ActivityIndicator color={BRAND_GOLD} /> : <Text style={styles.secondText}>Send me a new code</Text>}
          </Pressable>
          <Pressable style={styles.secondButton} onPress={askTrainer} disabled={busy !== null} accessibilityRole="button">
            {busy === "trainer" ? <ActivityIndicator color={BRAND_GOLD} /> : <Text style={styles.secondText}>No email? Ask {coach ? "the team" : "my trainer"} instead</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>Type the email you signed up with. We'll email you a code to pick a new password.</Text>
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
          <Pressable style={styles.button} onPress={emailCode} disabled={busy !== null} accessibilityRole="button">
            {busy === "email" ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Email me a code</Text>}
          </Pressable>
          <Pressable style={styles.secondButton} onPress={askTrainer} disabled={busy !== null} accessibilityRole="button">
            {busy === "trainer" ? (
              <ActivityIndicator color={BRAND_GOLD} />
            ) : (
              <Text style={styles.secondText}>{coach ? "Ask the team for a new password" : "Ask my trainer for a new password"}</Text>
            )}
          </Pressable>
          <Text style={styles.small}>
            Not sure which email you used? Tap Ask {coach ? "the team" : "my trainer"}: type your best guess and we'll still find you.
          </Text>
        </>
      )}
      <Pressable
        onPress={() => (step === "start" ? navigation.goBack() : setStep("start"))}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text style={styles.link}>{step === "start" ? "Back to log in" : "Back"}</Text>
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
  secondButton: { borderColor: BRAND_GOLD, borderWidth: 1.5, borderRadius: 10, padding: 13, alignItems: "center", marginTop: 10 },
  secondText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15, textAlign: "center" },
  codeInput: { fontSize: 22, letterSpacing: 6, textAlign: "center", fontWeight: "700" },
  small: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 12 },
  link: { color: "#94A3B8", textAlign: "center", marginTop: 24, fontWeight: "600" },
});
