import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

// Apple and Google both require apps with sign-up to let people delete their
// account from inside the app. The work happens in the delete-account Edge
// Function, which removes the client's photos and videos and then the account,
// taking every check-in, habit and log with it.
export default function DeleteAccountButton() {
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
      if (error) throw error;
      // The account is gone, so this just clears it off the phone.
      await signOut();
    } catch {
      Alert.alert("Couldn't delete your account", "Check your internet connection and try again. Nothing was deleted.");
      setDeleting(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, check-ins, habits, training log, progress photos and videos. It can't be undone.\n\nIf you're on a paid plan, talk to your trainer first: deleting your account doesn't cancel or refund it.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete everything", style: "destructive", onPress: deleteAccount },
      ]
    );

  return (
    <Pressable style={styles.button} onPress={confirm} disabled={deleting}>
      {deleting ? <ActivityIndicator color="#EF4444" /> : <Text style={styles.text}>Delete my account</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 12, alignItems: "center", marginTop: 12 },
  text: { color: "#EF4444", fontWeight: "600", fontSize: 14 },
});
