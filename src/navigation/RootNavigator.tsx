import React from "react";
import { View, ActivityIndicator, Text, Pressable, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import AuthNavigator from "@/navigation/AuthNavigator";
import ClientNavigator from "@/navigation/ClientNavigator";
import TrainerNavigator from "@/navigation/TrainerNavigator";
import IntakeFormScreen from "@/screens/client/IntakeFormScreen";

// A client's access is open unless their plan has actually expired.
// `expiring_soon` is a client who is still paid up, inside the renewal window
// that 0021's auto_expire_plans opens 7 days before expiry - they keep full
// access and see the expiry date on their Profile screen. Only `expired` closes
// the app, and a client row we failed to load falls through to
// PendingAccessScreen rather than being let in. Mirrored server-side by
// public.client_has_access in 0022.
export default function RootNavigator() {
  const { session, role, loading, client } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {role === "trainer" ? (
        <TrainerNavigator />
      ) : role === "client" && client != null && client.access_status !== "expired" ? (
        Object.keys(client.intake_responses ?? {}).length === 0 ? (
          <IntakeFormScreen />
        ) : (
          <ClientNavigator />
        )
      ) : role === "client" ? (
        <PendingAccessScreen />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

function PendingAccessScreen() {
  const { signOut } = useAuth();
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Almost there</Text>
      <Text style={styles.body}>
        Your account is created but not active yet. Once your trainer confirms your payment,
        you'll get full access here.
      </Text>
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
    padding: 24,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 12 },
  body: { color: "#94A3B8", textAlign: "center", lineHeight: 20 },
  logoutButton: { marginTop: 24, paddingVertical: 10, paddingHorizontal: 20 },
  logoutText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
});
