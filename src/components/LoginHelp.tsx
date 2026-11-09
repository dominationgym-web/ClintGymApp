import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Clipboard, Linking, Pressable, Text, View } from "react-native";
import { whatsappDigits } from "@/lib/videoCheckins";
import TextInput from "@/components/TextInput";
import { fixLoginEmail, loadLoginEmail, makeNewPassword } from "@/lib/loginHelp";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText, themedStyles } from "@/lib/theme";

// For a client (or, for the owner, a trainer) who can't log in (GRIZZ,
// 2026-11-09): shows the email they log in with, fixes a typo in it, and makes
// a new easy-to-read password the trainer passes on themselves.
export default function LoginHelp({ userId, name, phone }: { userId: string; name: string; phone?: string | null }) {
  const first = name.split(" ")[0] || "They";
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "email" | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLoginEmail(userId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setLoadError(error);
      else setEmail(data?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const newPassword = () =>
    Alert.alert(
      `New password for ${first}?`,
      "Their old password stops working straight away. You'll see the new one here to send them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Make a new password",
          onPress: async () => {
            setBusy("password");
            const { data, error } = await makeNewPassword(userId);
            setBusy(null);
            if (error || !data) Alert.alert("Couldn't change it", error ?? "Try again.");
            else {
              setPassword(data.password);
              setCopied(false);
            }
          },
        },
      ]
    );

  const saveEmail = async () => {
    if (draft === null) return;
    setBusy("email");
    const { data, error } = await fixLoginEmail(userId, draft);
    setBusy(null);
    if (error || !data) {
      Alert.alert("Couldn't change it", error ?? "Try again.");
      return;
    }
    setEmail(data.email);
    setDraft(null);
  };

  if (loadError) return <Text style={styles.helper}>{loadError}</Text>;
  if (email === undefined) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ alignSelf: "flex-start" }} />;

  return (
    <View>
      <Text style={styles.label}>Logs in with</Text>
      {draft === null ? (
        <>
          <Text style={styles.email} selectable>{email ?? "No email"}</Text>
          <Pressable onPress={() => setDraft(email ?? "")} hitSlop={6} accessibilityRole="button">
            <Text style={styles.link}>Email spelt wrong? Fix it</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="their@email.com"
            placeholderTextColor="#64748B"
          />
          <View style={styles.row}>
            <Pressable style={styles.smallButton} onPress={saveEmail} disabled={busy !== null} accessibilityRole="button">
              {busy === "email" ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.smallButtonText}>Save email</Text>}
            </Pressable>
            <Pressable onPress={() => setDraft(null)} hitSlop={6}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
          <Text style={styles.helper}>{first} logs in with the new email from now on. Their password stays the same.</Text>
        </>
      )}

      {password ? (
        <View style={styles.passwordBox}>
          <Text style={styles.label}>{first}'s new password</Text>
          <Text style={styles.password} selectable>{password}</Text>
          {/* Straight to their WhatsApp with the email and password filled in (GRIZZ, 2026-11-09). */}
          {whatsappDigits(phone) ? (
            <Pressable
              style={styles.button}
              onPress={() => {
                const text = `Hi ${first}, here's your new log-in for the app.\nEmail: ${email ?? ""}\nPassword: ${password}\nYou can pick your own password after logging in, under Profile > Account.`;
                Linking.openURL(`https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(text)}`).catch(() =>
                  Alert.alert("Couldn't open WhatsApp", "Copy the password instead and send it yourself.")
                );
              }}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Send on WhatsApp</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.copy}
            onPress={() => {
              try {
                Clipboard.setString(password);
                setCopied(true);
              } catch {
                // It's on screen to type out.
              }
            }}
            accessibilityRole="button"
          >
            <Text style={styles.copyText}>{copied ? "Copied ✓" : "Copy password"}</Text>
          </Pressable>
          <Text style={styles.helper}>
            {whatsappDigits(phone) ? `Send on WhatsApp opens ${first}'s chat with the email and password filled in: just tap send.` : `There's no phone number for ${first}, so copy it and send it yourself with the email above.`} Capital letters and dashes count. They can pick their own password after logging in, under Profile › Account.
          </Text>
        </View>
      ) : (
        <Pressable style={styles.button} onPress={newPassword} disabled={busy !== null} accessibilityRole="button">
          {busy === "password" ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Forgot password? Make a new one</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles({
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "600", marginBottom: 2 },
  email: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: BRAND_GOLD, fontWeight: "700", marginTop: 6 },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 6, lineHeight: 18 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  smallButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  smallButtonText: { color: "#0F172A", fontWeight: "700" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 13, alignItems: "center", marginTop: 14 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  passwordBox: { marginTop: 14, borderWidth: 1, borderColor: "#22C55E", borderRadius: 10, padding: 12 },
  password: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  copy: { borderColor: "#22C55E", borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8, alignSelf: "flex-start" },
  copyText: { color: "#22C55E", fontWeight: "700" },
});
