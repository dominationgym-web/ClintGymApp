import React from "react";
import { View, ActivityIndicator, Text, Pressable, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { resolveAppArea } from "@/lib/access";
import AuthNavigator from "@/navigation/AuthNavigator";
import ClientNavigator from "@/navigation/ClientNavigator";
import TrainerNavigator from "@/navigation/TrainerNavigator";
import IntakeFormScreen from "@/screens/client/IntakeFormScreen";

export default function RootNavigator() {
  const { session, role, loading, client } = useAuth();
  const area = resolveAppArea({ loading, hasSession: !!session, role, client });

  if (area === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {area === "trainer" ? (
        <TrainerNavigator />
      ) : area === "intake" ? (
        <IntakeFormScreen />
      ) : area === "client" ? (
        <ClientNavigator />
      ) : area === "pending" ? (
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
