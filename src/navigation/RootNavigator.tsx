import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import AuthNavigator from "@/navigation/AuthNavigator";
import ClientNavigator from "@/navigation/ClientNavigator";
import TrainerNavigator from "@/navigation/TrainerNavigator";
import IntakeFormScreen from "@/screens/client/IntakeFormScreen";

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
      {!session ? (
        <AuthNavigator />
      ) : role === "trainer" ? (
        <TrainerNavigator />
      ) : role === "client" && client?.access_status === "active" ? (
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
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Almost there</Text>
      <Text style={styles.body}>
        Your account is created but not active yet. Once your trainer confirms your payment,
        you'll get full access here.
      </Text>
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
});
