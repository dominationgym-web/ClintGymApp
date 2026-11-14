import NotificationsPrompt from "@/components/NotificationsPrompt";
import { onNotificationTap, registerForCoachMessages } from "@/lib/notifications";
import { notificationRoute, type NotificationRoute } from "@/lib/notificationRoutes";
import React, { useEffect, useRef, useState } from "react";
import { recordAppOpen } from "@/lib/awardUploads";
import { View, ActivityIndicator, Text, Pressable, Platform } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { NavigationContainer, type NavigationState } from "@react-navigation/native";
import { navigationRef } from "@/navigation/navigationRef";
import { useAuth } from "@/context/AuthContext";
import AuthNavigator from "@/navigation/AuthNavigator";
import KeyboardSafe from "@/components/KeyboardSafe";
import ClientNavigator from "@/navigation/ClientNavigator";
import TrainerNavigator from "@/navigation/TrainerNavigator";
import IntakeFormScreen from "@/screens/client/IntakeFormScreen";
import AwardPitchCard from "@/components/award/AwardPitchCard";
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
import { themeBg, themeText, themedStyles, useThemeChosen } from "@/lib/theme";
import ThemeChoiceScreen from "@/screens/ThemeChoiceScreen";

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

function openRoute(route: NotificationRoute) {
  if (route.stack === "client" && route.screen === "Timers") navigationRef.navigate("Timers", { tab: "saved" });
  else if (route.screen === "VideoCheckIn" || route.screen === "VideoCheckIns") navigationRef.navigate(route.screen);
  else if (route.screen === "MySessions" || route.screen === "LiveSessions") navigationRef.navigate(route.screen, { tab: route.tab });
  else if (route.stack === "client") navigationRef.navigate("ClientTabs", { screen: route.screen });
  else if (route.screen === "ClientDetail")
    navigationRef.navigate("ClientDetail", { clientId: route.clientId, tab: route.tab, open: route.open });
  else if (route.screen === "Billing" || route.screen === "Challenges" || route.screen === "Award" || route.screen === "AwardAdmin")
    navigationRef.navigate(route.screen);
  else if (route.screen === "TrainerProblems") navigationRef.navigate("TrainerProblems", { problemId: route.problemId });
  else navigationRef.navigate("TrainerTabs", { screen: route.screen });
}

// The open pages, so switching light/dark (which remounts this) lands you back where you were.
let savedNavState: NavigationState | undefined;

export default function RootNavigator() {
  const { role, loading, client, trainer } = useAuth();
  const themeChosen = useThemeChosen();
  const locked = useLockedOut(role, role === "trainer" ? trainer : client);
  // Trainer of the Half-Year (0194): which phone opened the app today, for the
  // fake-account check. The database ignores it while the award is off.
  useEffect(() => {
    if (role) recordAppOpen();
  }, [role]);
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
        <ActivityIndicator color={themeText("#22C55E")} />
      </View>
    );
  }

  // Light or dark first, straight after signing up (GRIZZ, 2026-11-04).
  if (role && !themeChosen) return <ThemeChoiceScreen />;

  return (
    <KeyboardSafe>
    {role === "trainer" ? <CardPaymentReturn /> : null}
    <NavigationContainer
      ref={navigationRef}
      initialState={savedNavState}
      onStateChange={(state) => {
        savedNavState = state;
      }}
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

// A client who hasn't been switched on yet, or whose plan has expired. Shows
// their own trainer's payment details (0029) so they can pay and be switched on.
// GRIZZ, 2026-11-13: clients felt stuck here with Log out as the only way off
// the page. Now: a Back button at the top, a "Check again" button that lets
// them straight in once the trainer has switched them on, and 1 on 1 clients
// (who pay per session on the trainer's invoices) aren't asked to pay a plan.
function PendingAccessScreen() {
  const { signOut, client, refreshProfile } = useAuth();
  // So the client's phone hears the moment their trainer activates them (0056).
  useEffect(() => {
    registerForCoachMessages();
  }, []);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
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
  // On the trainer's 1 on 1 side (linked to their calendar name, or 1 on 1 only).
  const oneOnOne = !!(client?.one_on_one || client?.live_only);
  const coach = trainer ? trainerDisplayName(trainer) : "your trainer";

  // If the trainer has switched them on, this opens the app; otherwise it says so.
  const checkAgain = async () => {
    setChecking(true);
    setChecked(false);
    await refreshProfile();
    setChecking(false);
    setChecked(true);
  };

  return (
    <ScrollView style={{ backgroundColor: themeBg("#0F172A") }} contentContainerStyle={styles.pendingContainer}>
      <Pressable onPress={signOut} hitSlop={10} style={styles.backButton} accessibilityRole="button">
        <Text style={styles.backText}>‹ Back to log in</Text>
      </Pressable>
      <NotificationsPrompt who="client" />
      <Text style={styles.title}>{neverActivated ? "Almost there" : oneOnOne ? "Your app is paused" : "Your plan has ended"}</Text>
      <Text style={styles.body}>
        {neverActivated && oneOnOne
          ? `You train 1 on 1 with ${coach}, so there's nothing to pay here. Your app opens by itself the moment ${coach} switches it on.`
          : neverActivated
            ? `Your account is made. Pay for your plan with the details below and ${coach} switches your app on. It opens by itself the moment they do. Training 1 on 1 with ${coach}? Then there's nothing to pay here.`
            : oneOnOne
              ? `${coach} has paused your app. Everything you've logged is saved. Chat to ${coach}, and it opens by itself the moment they switch it back on.`
              : "To keep going, renew your plan using the details below and let your trainer know. They'll switch your access back on."}
      </Text>
      {trainer ? (
        <View style={styles.trainerRow}>
          <TrainerLogo name={trainerDisplayName(trainer)} path={trainer.logo_path} size={44} />
          <Text style={styles.trainerName}>{trainerDisplayName(trainer)}</Text>
        </View>
      ) : null}
      <Pressable style={styles.checkButton} onPress={checkAgain} disabled={checking} accessibilityRole="button">
        {checking ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.checkText}>Check again</Text>}
      </Pressable>
      {checked && !checking ? (
        <Text style={[styles.body, { marginTop: 8 }]}>Not switched on yet. {oneOnOne ? `Give ${coach} a shout.` : `Paid already? Send ${coach} your proof below.`}</Text>
      ) : null}
      {neverActivated && oneOnOne ? null : (
        <>
          <TrainerPaymentDetails eftDetails={trainer?.eft_details} popWhatsapp={trainer?.pop_whatsapp} proofInApp={!!trainer} />
          {client && trainer ? (
            <SendProofOfPayment to="trainer" payerId={client.id} trainerId={trainer.id} receiverName={trainerDisplayName(trainer)} />
          ) : null}
          <AbroadPayment trainer={trainer} />
        </>
      )}
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
    <ScrollView style={{ backgroundColor: themeBg("#0F172A") }} contentContainerStyle={styles.pendingContainer}>
      <Text style={[styles.title, { textAlign: "center" }]}>{blocked ? "Your account has been paused" : "Thanks for applying"}</Text>
      <Text style={styles.body}>
        {blocked
          ? "The app owner has paused your trainer account. Your clients and their data are safe. Please contact the app owner to switch it back on."
          : "Your trainer account is waiting for approval. Once it's approved, open the app again and you'll be able to set up your profile and invite your clients."}
      </Text>
      {blocked ? null : <AwardPitchCard />}
      {trainer ? <Text style={[styles.body, { marginTop: 12 }]}>Signed in as {trainer.email}</Text> : null}
      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <DeleteAccountButton />
    </ScrollView>
  );
}

// A trainer whose plan or client fees are unpaid, once the owner has switched
// lockout on (0064). The owner records the payment and they're back in.
function TrainerLockedScreen() {
  const { signOut, trainer } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: themeBg("#0F172A") }} contentContainerStyle={styles.pendingContainer}>
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

const styles = themedStyles({
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
  backButton: { alignSelf: "flex-start", paddingVertical: 8, marginBottom: 8 },
  backText: { color: "#D4AF37", fontSize: 16, fontWeight: "700" },
  checkButton: { backgroundColor: "#D4AF37", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  checkText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
