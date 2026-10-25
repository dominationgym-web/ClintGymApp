import NotificationsPrompt from "@/components/NotificationsPrompt";
import { onNotificationTap, registerForCoachMessages } from "@/lib/notifications";
import { notificationRoute, type NotificationRoute } from "@/lib/notificationRoutes";
import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import AuthNavigator from "@/navigation/AuthNavigator";
import KeyboardSafe from "@/components/KeyboardSafe";
import ClientNavigator from "@/navigation/ClientNavigator";
import TrainerNavigator from "@/navigation/TrainerNavigator";
import IntakeFormScreen from "@/screens/client/IntakeFormScreen";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import TrainerLogo from "@/components/TrainerLogo";
import TrainerPaymentDetails from "@/components/TrainerPaymentDetails";
import SendProofOfPayment from "@/components/SendProofOfPayment";
import TrainerPlanCard from "@/components/TrainerPlanCard";
import { CardPaymentReturn } from "@/components/CardPayment";
import { supabase } from "@/lib/supabase";
import { needsAgreement, trainerDisplayName } from "@/lib/trainers";
import TrainerAgreementScreen from "@/screens/trainer/TrainerAgreementScreen";
import { TRAINER_AGREEMENT_VERSION } from "@/screens/auth/TrainerAgreementContent";
import type { Trainer } from "@/types/database";

// A client's access is open unless their plan has actually expired.
// `expiring_soon` is a client who is still paid up, inside the renewal window
// that 0021's auto_expire_plans opens 7 days before expiry - they keep full
// access and see the expiry date on their Profile screen. Only `expired` closes
// the app, and a client row we failed to load falls through to
// PendingAccessScreen rather than being let in. Mirrored server-side by
// public.client_has_access in 0022.
// Is this trainer, or this client's trainer, locked out for not paying (0064)?
// Re-checked whenever AuthContext reloads the profile (on opening the app).
function useLockedOut(role: string | null, profile: unknown) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!role) {
      setLocked(false);
      return;
    }
    let cancelled = false;
    supabase.rpc("am_i_locked").then(({ data }) => {
      if (!cancelled) setLocked(data === true);
    });
    return () => {
      cancelled = true;
    };
  }, [role, profile]);
  return locked;
}

// Tapping a notification opens the screen it is about (notificationRoutes.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigationRef = createNavigationContainerRef<any>();

function openRoute(route: NotificationRoute) {
  if (route.stack === "client" && route.screen === "Chat") navigationRef.navigate("Chat");
  else if (route.stack === "client") navigationRef.navigate("ClientTabs", { screen: route.screen });
  else if (route.screen === "Chat") navigationRef.navigate("Chat", { clientId: route.clientId });
  else if (route.screen === "Messages") navigationRef.navigate("Messages");
  else if (route.screen === "ClientDetail")
    navigationRef.navigate("ClientDetail", { clientId: route.clientId, tab: route.tab, open: route.open });
  else if (route.screen === "Billing") navigationRef.navigate("Billing");
  else if (route.screen === "TrainerProblems") navigationRef.navigate("TrainerProblems", { problemId: route.problemId });
  else navigationRef.navigate("TrainerTabs", { screen: route.screen });
}

export default function RootNavigator() {
  const { role, loading, client, trainer } = useAuth();
  const locked = useLockedOut(role, role === "trainer" ? trainer : client);
  // A tap that arrives before the screens are ready waits here.
  const pendingRoute = useRef<NotificationRoute | null>(null);
  useEffect(() => {
    if (!role) return;
    return onNotificationTap((data) => {
      const route = notificationRoute(data, role);
      if (!route) return;
      if (navigationRef.isReady()) openRoute(route);
      else pendingRoute.current = route;
    });
  }, [role]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <KeyboardSafe>
    {role === "trainer" ? <CardPaymentReturn /> : null}
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingRoute.current) openRoute(pendingRoute.current);
        pendingRoute.current = null;
      }}
    >
      {role === "trainer" && trainer && needsAgreement(trainer, TRAINER_AGREEMENT_VERSION) ? (
        <TrainerAgreementScreen />
      ) : role === "trainer" && trainer?.approved && locked ? (
        <TrainerLockedScreen />
      ) : role === "trainer" && trainer?.approved ? (
        <TrainerNavigator />
      ) : role === "trainer" ? (
        <PendingTrainerScreen />
      ) : role === "client" && client != null && Object.keys(client.intake_responses ?? {}).length === 0 ? (
        // Straight after signing up, before payment and activation, so the
        // trainer has the client's details when they activate them.
        <IntakeFormScreen />
      ) : role === "client" && client != null && client.access_status !== "expired" && locked ? (
        <CoachPausedScreen />
      ) : role === "client" && client != null && client.access_status !== "expired" ? (
        <ClientNavigator />
      ) : role === "client" ? (
        <PendingAccessScreen />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
    </KeyboardSafe>
  );
}

// A client who hasn't paid yet, or whose plan has expired. Shows their own
// trainer's payment details (0029) so they can pay and be switched on.
function PendingAccessScreen() {
  const { signOut, client } = useAuth();
  // So the client's phone hears the moment their trainer activates them (0056).
  useEffect(() => {
    registerForCoachMessages();
  }, []);
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
      <NotificationsPrompt who="client" />
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
      <TrainerPaymentDetails eftDetails={trainer?.eft_details} popWhatsapp={trainer?.pop_whatsapp} proofInApp={!!trainer} />
      {client && trainer ? (
        <SendProofOfPayment to="trainer" payerId={client.id} trainerId={trainer.id} receiverName={trainerDisplayName(trainer)} />
      ) : null}
      <AbroadPayment trainer={trainer} />
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <DeleteAccountButton />
    </ScrollView>
  );
}

// Paying from outside South Africa (app-flow review C9, 2026-10-18). The app
// only knows the trainer's EFT details, so this just says to ask the trainer.
// It shows straight away when the trainer is outside South Africa (0096), and
// otherwise sits behind one tap so South African clients aren't sent looking
// for a way to pay that isn't there.
function AbroadPayment({ trainer }: { trainer: Trainer | null }) {
  const [open, setOpen] = useState(false);
  const abroad = !!trainer?.signup_country && trainer.signup_country !== "ZA";
  if (!abroad && !open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={{ marginTop: 16 }} accessibilityRole="button">
        <Text style={[styles.body, styles.link]}>Paying from outside South Africa? ›</Text>
      </Pressable>
    );
  }
  return (
    <>
      <Text style={styles.sectionHeading}>Paying from outside South Africa</Text>
      <Text style={styles.body}>Ask your trainer how to pay from abroad. They'll send you the details directly.</Text>
    </>
  );
}

// A trainer who signed up from the app waits here until the app owner approves
// them (0029). The foreground refresh in AuthContext picks up the approval.
function PendingTrainerScreen() {
  const { signOut, trainer } = useAuth();
  // So the trainer's phone hears the moment they're approved (0056).
  useEffect(() => {
    registerForCoachMessages();
  }, []);
  // approved_at stays set once the owner has approved them, so a trainer with
  // it but no approval has been blocked, not newly applied.
  const blocked = !!trainer?.approved_at;
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{blocked ? "Your account has been paused" : "Thanks for applying"}</Text>
      <Text style={styles.body}>
        {blocked
          ? "The app owner has paused your trainer account. Your clients and their data are safe. Please contact the app owner to switch it back on."
          : "Your trainer account is waiting for approval. Once it's approved, open the app again and you'll be able to set up your profile and invite your clients."}
      </Text>
      {trainer ? <Text style={[styles.body, { marginTop: 12 }]}>Signed in as {trainer.email}</Text> : null}
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <DeleteAccountButton />
    </View>
  );
}

// A trainer whose plan or client fees are unpaid, once the owner has switched
// lockout on (0064). The owner records the payment and they're back in.
function TrainerLockedScreen() {
  const { signOut, trainer } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: "#0F172A" }} contentContainerStyle={styles.pendingContainer}>
      <Text style={styles.title}>Your account is paused</Text>
      <Text style={[styles.body, { marginBottom: 16 }]}>
        {Platform.OS === "web"
          ? "Your Daily Evolution payment is outstanding. Pay by card or EFT below. Your access comes back as soon as it's confirmed. Your clients and their data are safe in the meantime."
          : "Your Daily Evolution payment is outstanding. Your access comes back as soon as it's paid. Your clients and their data are safe in the meantime."}
      </Text>
      {trainer ? <TrainerPlanCard trainer={trainer} showPayment /> : null}
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

// A client whose trainer's account is paused for non-payment (0064).
function CoachPausedScreen() {
  const { signOut } = useAuth();
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Your coach's account is paused</Text>
      <Text style={styles.body}>
        Your coach's app account needs attention. Nothing is lost: your plan, streaks and logs are all saved. Please
        check in with your coach, and open the app again once they let you know it's back.
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
  logoutButton: { marginTop: 24, paddingVertical: 10, paddingHorizontal: 20, alignSelf: "center" },
  pendingContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  trainerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  trainerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logoutText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
  link: { color: "#22C55E", fontWeight: "600" },
});
