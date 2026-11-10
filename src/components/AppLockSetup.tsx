import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import ModalSafeArea from "@/components/ModalSafeArea";
import PinPad from "@/components/PinPad";
import { changeAppLockPin, checkAppLockPin, turnOffAppLock, turnOnAppLock } from "@/lib/appLock";
import { isWeakPin, PIN_LENGTH } from "@/lib/appLockRules";
import { askBiometrics, biometricKind, biometricName, type BiometricKind } from "@/lib/biometrics";
import { BRAND_GOLD } from "@/lib/brand";
import { themeBg, themedStyles } from "@/lib/theme";

export type AppLockSetupMode = "new" | "change" | "off";

type Step = "current" | "pick" | "confirm" | "bio";

// Setting the PIN, step by step, all on tap buttons:
// new: pick a PIN → type it again → use fingerprint/Face ID too?
// change: current PIN → new PIN → again.  off: current PIN.
export function AppLockSetupSteps({ mode, onDone, onCancel }: { mode: AppLockSetupMode; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>(mode === "new" ? "pick" : "current");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<BiometricKind | null>(null);

  useEffect(() => {
    if (mode === "new") biometricKind().then(setKind);
  }, [mode]);

  const clearSoon = () => setTimeout(() => setPin(""), 250);

  const onChange = async (next: string) => {
    setMessage(null);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (step === "current") {
      if (!checkAppLockPin(next)) {
        setMessage("That's not your PIN. Try again.");
        clearSoon();
        return;
      }
      if (mode === "off") {
        await turnOffAppLock();
        onDone();
        return;
      }
      setStep("pick");
      clearSoon();
      return;
    }
    if (step === "pick") {
      if (isWeakPin(next)) {
        setMessage("Too easy to guess. Pick 4 digits that aren't all the same or in a row.");
        clearSoon();
        return;
      }
      setFirst(next);
      setStep("confirm");
      clearSoon();
      return;
    }
    if (step === "confirm") {
      if (next !== first) {
        setMessage("Those didn't match. Pick your PIN again.");
        setFirst("");
        setStep("pick");
        clearSoon();
        return;
      }
      if (mode === "change") {
        await changeAppLockPin(next);
        onDone();
        return;
      }
      if (kind) {
        setStep("bio");
        return;
      }
      await turnOnAppLock(next, false);
      onDone();
    }
  };

  const finishWithBio = async (useBio: boolean) => {
    if (useBio) {
      const ok = await askBiometrics(`Check your ${biometricName(kind)}`);
      if (!ok) {
        setMessage(`That didn't work. Try again, or tap PIN only.`);
        return;
      }
    }
    await turnOnAppLock(first, useBio);
    onDone();
  };

  const title =
    step === "current"
      ? mode === "off"
        ? "Enter your PIN to turn the lock off"
        : "Enter your current PIN"
      : step === "pick"
        ? mode === "change"
          ? "Pick a new 4-digit PIN"
          : "Pick a 4-digit PIN"
        : step === "confirm"
          ? "Tap the same PIN again"
          : `Use your ${biometricName(kind)} too?`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>🔒 APP LOCK</Text>
      <Text style={styles.title}>{title}</Text>
      {step === "bio" ? (
        <>
          <Text style={styles.hint}>
            Then the app opens with your {biometricName(kind)}, and the PIN is there if it doesn't work.
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable style={styles.button} onPress={() => finishWithBio(true)} accessibilityRole="button">
            <Text style={styles.buttonText}>Yes, use {biometricName(kind)}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => finishWithBio(false)} accessibilityRole="button">
            <Text style={styles.secondaryText}>PIN only</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.hint, message ? styles.message : null]}>
            {message ??
              (step === "pick" && mode === "new"
                ? "You'll tap this when the app opens. Keep it different from your bank card PIN."
                : " ")}
          </Text>
          <PinPad value={pin} onChange={onChange} />
          <Pressable style={styles.secondary} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

/** The same steps as a full page, opened from Settings. */
export default function AppLockSetupModal({ mode, onClose }: { mode: AppLockSetupMode | null; onClose: () => void }) {
  if (!mode) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={[styles.page, { backgroundColor: themeBg("#0F172A") }]}>
        <AppLockSetupSteps mode={mode} onDone={onClose} onCancel={onClose} />
      </ModalSafeArea>
    </Modal>
  );
}

const styles = themedStyles({
  page: { flex: 1, justifyContent: "center", padding: 24 },
  wrap: { alignItems: "center" },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  title: { color: "#FFFFFF", fontSize: 21, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  hint: { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 22, minHeight: 20 },
  message: { color: "#EF4444", fontWeight: "700" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", alignSelf: "stretch", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  secondary: { alignItems: "center", padding: 12, marginTop: 4 },
  secondaryText: { color: "#CBD5E1", fontWeight: "700", fontSize: 15 },
});
