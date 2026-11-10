import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { checkAppLockPin, getAppLock, useAppLock, useAppLockReady } from "@/lib/appLock";
import { afterWrongPin, PIN_LENGTH, shouldLockAfterAway, waitSecondsLeft } from "@/lib/appLockRules";
import { askBiometrics, biometricKind, biometricName, type BiometricKind } from "@/lib/biometrics";
import { BRAND_GOLD } from "@/lib/brand";
import { themeBg, themedStyles } from "@/lib/theme";
import PinPad from "@/components/PinPad";

// App lock (GRIZZ, 2026-11-10). Asks for the fingerprint / Face ID or the PIN
// when the app opens, and again after it has been away for the chosen time.
//
// While locked, the app's screens are not drawn at all (not just covered), so
// nothing private shows behind the lock and no pop-up can sit on top of it.
// After unlocking you land back on the page you were on (RootNavigator keeps it).
export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const lock = useAppLock();
  const ready = useAppLockReady();
  const [locked, setLocked] = useState(true);
  const decided = useRef(false);
  const awaySince = useRef<number | null>(null);

  // Opening the app: locked if the lock is on. Turning it on later doesn't lock you straight away.
  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    setLocked(getAppLock().enabled);
  }, [ready]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        if (awaySince.current == null) awaySince.current = Date.now();
      } else if (state === "active") {
        const since = awaySince.current;
        awaySince.current = null;
        const now = getAppLock();
        if (since != null && now.enabled && shouldLockAfterAway(Date.now() - since, now.delayMinutes)) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;
  if (role && lock.enabled && locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  return <>{children}</>;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { signOut } = useAuth();
  const lock = useAppLock();
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [wrongTries, setWrongTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const asking = useRef(false);

  const tryBiometrics = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const ok = await askBiometrics("Unlock Daily Evolution");
    asking.current = false;
    if (ok) onUnlock();
  }, [onUnlock]);

  // Straight to the fingerprint / Face ID prompt if they chose it.
  useEffect(() => {
    if (!lock.biometrics) return;
    let cancelled = false;
    biometricKind().then((k) => {
      if (cancelled) return;
      setKind(k);
      if (k && AppState.currentState === "active") tryBiometrics();
    });
    return () => {
      cancelled = true;
    };
  }, [lock.biometrics, tryBiometrics]);

  const waiting = waitSecondsLeft(waitUntil, now);
  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= waitUntil) setWaitUntil(null);
    }, 500);
    return () => clearInterval(t);
  }, [waitUntil]);

  const onChange = (next: string) => {
    setWrong(false);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (checkAppLockPin(next)) {
      onUnlock();
      return;
    }
    const after = afterWrongPin(wrongTries, Date.now());
    setWrongTries(after.wrongTries);
    setWaitUntil(after.waitUntil);
    setNow(Date.now());
    setWrong(true);
    setTimeout(() => setPin(""), 250);
  };

  const forgot = () =>
    Alert.alert(
      "Forgot your PIN?",
      "Log out, then sign in again with your email and password. Your PIN is cleared and you can set a new one in Settings. Nothing in your account is lost.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: () => signOut() },
      ]
    );

  const bio = lock.biometrics && kind;
  return (
    <SafeAreaView style={[styles.page, { backgroundColor: themeBg("#0F172A") }]}>
      <View style={styles.top}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.title}>Daily Evolution is locked</Text>
        <Text style={[styles.hint, wrong && styles.wrong]}>
          {waiting > 0
            ? `Too many wrong tries. Try again in ${waiting} second${waiting === 1 ? "" : "s"}.`
            : wrong
              ? "Wrong PIN. Try again."
              : bio
                ? `Use your ${biometricName(kind)} or enter your PIN`
                : "Enter your PIN"}
        </Text>
      </View>
      <PinPad
        value={pin}
        onChange={onChange}
        disabled={waiting > 0}
        extraKey={
          bio
            ? { label: kind === "face" ? "🙂" : "👆", onPress: tryBiometrics, accessibilityLabel: `Use ${biometricName(kind)}` }
            : null
        }
      />
      <Pressable onPress={forgot} hitSlop={10} style={styles.forgot} accessibilityRole="button">
        <Text style={styles.forgotText}>Forgot your PIN?</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = themedStyles({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  top: { alignItems: "center", marginBottom: 28 },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  hint: { color: "#94A3B8", fontSize: 15, textAlign: "center", minHeight: 22 },
  wrong: { color: "#EF4444", fontWeight: "700" },
  forgot: { marginTop: 8, padding: 8 },
  forgotText: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700" },
});
