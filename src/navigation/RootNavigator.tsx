import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import AuthNavigator from "@/navigation/AuthNavigator";
import ClientNavigator from "@/navigation/ClientNavigator";
import TrainerNavigator from "@/navigation/TrainerNavigator";
import IntakeFormScreen from "@/screens/client/IntakeFormScreen";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import TrainerLogo from "@/components/TrainerLogo";
import TrainerPaymentDetails from "@/components/TrainerPaymentDetails";
import { supabase } from "@/lib/supabase";
import { trainerDisplayName } from "@/lib/trainers";
import type { Trainer } from "@/types/database";

// A client's access is open unless their plan has actually expired.
// `expiring_soon` is a client who is still paid up, inside the renewal window
// that 0021's auto_expire_plans opens 7 days before expiry - they keep full
// access and see the expiry date on their Profile screen. Only `expired` closes
// the app, and a client row we failed to load falls through to
// PendingAccessScreen rather than being let in. Mirrored server-side by
// public.client_has_access in 0022.
export default function RootNavigator() {
  const { role, loading, client, trainer } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {role === "trainer" && trainer?.approved ? (
        <TrainerNavigator />
      ) : role === "trainer" ? (
        <PendingTrainerScreen />
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

// A client who hasn't paid yet, or whose plan has expired. Shows their own
// trainer's payment details (0029) so they can pay and be switched on.
function PendingAccessScreen() {
  const { signOut, client } = useAuth();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const trainerId = client?.trainer_id;

  useEffect(() => {
    if (!trainerId) return;
    let cancelled = false;
    supabase
      .from("trainers")
      .select("*")
      .eq("id", trainerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTrainer(data);
      });
    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  const neverActivated = client?.plan_started_at == null;

  return (
    <ScrollView style={{ backgroundColor: "#0F172A" }} contentContainerStyle={styles.pendingContainer}>
      <Text style={styles.title}>{neverActivated ? "One last step" : "Your plan has ended"}</Text>
      <Text style={styles.body}>
        {neverActivated
          ? "Your account is created but not active yet. Pay for your plan using the details below, then let your trainer know. They'll confirm payment and switch on your access."
          : "To keep going, renew your plan using the details below and let your trainer know. They'll switch your access back on."}
      </Text>
      {trainer ? (
        <View style={styles.trainerRow}>
          <TrainerLogo name={trainerDisplayName(trainer)} path={trainer.logo_path} size={44} />
          <Text style={styles.trainerName}>{trainerDisplayName(trainer)}</Text>
        </View>
      ) : null}
      <TrainerPaymentDetails eftDetails={trainer?.eft_details} popWhatsapp={trainer?.pop_whatsapp} />
      <Text style={styles.sectionHeading}>International - PayPal</Text>
      <Text style={styles.body}>PayPal details will be sent to you directly by your trainer.</Text>
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <DeleteAccountButton />
    </ScrollView>
  );
}

// A trainer who signed up from the app waits here until the app owner approves
// them (0029). The foreground refresh in AuthContext picks up the approval.
function PendingTrainerScreen() {
  const { signOut, trainer } = useAuth();
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Thanks for applying</Text>
      <Text style={styles.body}>
        Your trainer account is waiting for approval. Once it's approved, open the app again and you'll be able to
        set up your profile and invite your clients.
      </Text>
      {trainer ? <Text style={[styles.body, { marginTop: 12 }]}>Signed in as {trainer.email}</Text> : null}
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <DeleteAccountButton />
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
  logoutButton: { marginTop: 24, paddingVertical: 10, paddingHorizontal: 20, alignSelf: "center" },
  pendingContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  trainerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  trainerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logoutText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
});
