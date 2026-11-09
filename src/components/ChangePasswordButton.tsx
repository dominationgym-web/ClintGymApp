import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import PasswordInput from "@/components/PasswordInput";
import { supabase } from "@/lib/supabase";
import { passwordProblem } from "@/lib/passwordRules";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText, themedStyles } from "@/lib/theme";

// Under Account: pick a new password, e.g. after the trainer gave them one
// (GRIZZ, 2026-11-09).
export default function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const problem = passwordProblem(password, again);
    if (problem) {
      Alert.alert("Check your password", problem);
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't change it", /different from the old/i.test(error.message) ? "That's already your password." : error.message);
      return;
    }
    setOpen(false);
    setPassword("");
    setAgain("");
    Alert.alert("Password changed", "Use your new password next time you log in.");
  };

  if (!open) {
    return (
      <Pressable style={styles.outline} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.outlineText}>Change my password</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.label}>New password</Text>
      <PasswordInput placeholder="At least 8 letters or numbers" value={password} onChangeText={setPassword} autoCapitalize="none" />
      <Text style={styles.label}>Type it again</Text>
      <PasswordInput placeholder="Same again" value={again} onChangeText={setAgain} autoCapitalize="none" />
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={save} disabled={saving} accessibilityRole="button">
          {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save password</Text>}
        </Pressable>
        <Pressable onPress={() => setOpen(false)} hitSlop={6}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles({
  outline: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 12 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  box: { marginBottom: 12 },
  label: { color: "#CBD5E1", fontWeight: "600", marginBottom: 6, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  buttonText: { color: "#0F172A", fontWeight: "700" },
  cancel: { color: "#94A3B8", fontWeight: "600" },
});
