import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useAuth } from "@/context/AuthContext";
import { AppLockSetupSteps } from "@/components/AppLockSetup";
import { appLockSuggested, markAppLockSuggested, useAppLock } from "@/lib/appLock";
import { BRAND_GOLD } from "@/lib/brand";
import { popupOpen, setPopupOpen } from "@/lib/popupGate";
import { themedStyles } from "@/lib/theme";

// Trainers are asked once on each phone to lock the app, because their
// earnings, invoices and client details are in it (GRIZZ, 2026-11-10).
// The PIN is set right here, in the same pop-up (two pop-ups at once don't show on iPhone).
export default function AppLockSuggestPopup() {
  const { trainer } = useAuth();
  const lock = useAppLock();
  const [visible, setVisible] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  const approved = !!trainer?.approved;
  useEffect(() => {
    if (!approved || lock.enabled) return;
    let cancelled = false;
    // A moment after opening, so the trainer's other first-day pop-ups go first.
    const t = setTimeout(async () => {
      if (cancelled || (await appLockSuggested()) || popupOpen("appLock")) return;
      if (!cancelled) setVisible(true);
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [approved, lock.enabled]);

  useEffect(() => {
    setPopupOpen("appLock", visible);
    return () => setPopupOpen("appLock", false);
  }, [visible]);

  if (!visible) return null;
  const close = () => {
    setVisible(false);
    setSettingUp(false);
    markAppLockSuggested();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ScrollView contentContainerStyle={styles.backdrop}>
        <View style={styles.popup}>
          {settingUp ? (
            <AppLockSetupSteps mode="new" onDone={close} onCancel={() => setSettingUp(false)} />
          ) : (
            <>
              <Text style={styles.kicker}>🔒 KEEP IT PRIVATE</Text>
              <Text style={styles.title}>Lock the app?</Text>
              <Text style={styles.body}>
                Your earnings, invoices and client details are in this app. With the app lock on, it asks for your
                {Platform.OS === "web" ? " 4-digit PIN" : " fingerprint, Face ID or a 4-digit PIN"} when it opens, so nobody else holding your phone can look.
              </Text>
              <Pressable style={styles.button} onPress={() => setSettingUp(true)} accessibilityRole="button">
                <Text style={styles.buttonText}>Set up the lock</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={close} accessibilityRole="button">
                <Text style={styles.secondaryText}>Not now</Text>
              </Pressable>
              <Text style={styles.footnote}>You can turn it on any time: Profile › Settings › App lock.</Text>
            </>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flexGrow: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20 },
  popup: { backgroundColor: "#0F172A", borderRadius: 16, padding: 22, borderWidth: 1.5, borderColor: BRAND_GOLD },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 10 },
  body: { color: "#CBD5E1", fontSize: 15, lineHeight: 21 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  secondary: { alignItems: "center", padding: 12, marginTop: 4 },
  secondaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  footnote: { color: "#64748B", fontSize: 12, textAlign: "center" },
});
