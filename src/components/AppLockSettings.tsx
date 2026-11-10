import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import AppLockSetupModal, { type AppLockSetupMode } from "@/components/AppLockSetup";
import { setAppLockBiometrics, setAppLockDelay, useAppLock } from "@/lib/appLock";
import { LOCK_DELAY_OPTIONS } from "@/lib/appLockRules";
import { askBiometrics, biometricKind, biometricName, type BiometricKind } from "@/lib/biometrics";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";

export const APP_LOCK_HINT_OFF = "Off: anyone holding your phone can open the app";

export function appLockSummary(enabled: boolean, biometrics: boolean): string {
  if (!enabled) return APP_LOCK_HINT_OFF;
  return biometrics ? "On: fingerprint or Face ID, PIN as back-up" : "On: 4-digit PIN";
}

// Settings card for the app lock (GRIZZ, 2026-11-10). Saved on this phone or laptop only.
export default function AppLockSettings({ showTitle = true }: { showTitle?: boolean }) {
  const lock = useAppLock();
  const [mode, setMode] = useState<AppLockSetupMode | null>(null);
  const [kind, setKind] = useState<BiometricKind | null>(null);
  useEffect(() => {
    biometricKind().then(setKind);
  }, []);

  const turnBio = async (on: boolean) => {
    if (on && !(await askBiometrics(`Check your ${biometricName(kind)}`))) return;
    await setAppLockBiometrics(on);
  };

  return (
    <View style={styles.card}>
      {showTitle ? <Text style={styles.title}>App lock</Text> : null}
      {!lock.enabled ? (
        <>
          <Text style={styles.hint}>
            Keeps your money, sessions and client details private. The app asks for your
            {Platform.OS === "web" ? " PIN" : " fingerprint, Face ID or PIN"} when it opens, and again after it's been
            closed for a while.
          </Text>
          <Pressable style={styles.button} onPress={() => setMode("new")} accessibilityRole="button">
            <Text style={styles.buttonText}>Turn on app lock</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.on}>🔒 {appLockSummary(true, lock.biometrics && !!kind)}</Text>
          <Text style={styles.label}>Ask again after the app has been closed for</Text>
          <View style={styles.row}>
            {LOCK_DELAY_OPTIONS.map((o) => {
              const on = lock.delayMinutes === o.minutes;
              return (
                <Pressable
                  key={o.minutes}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setAppLockDelay(o.minutes)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {kind ? (
            <>
              <Text style={styles.label}>Unlock with your {biometricName(kind)}</Text>
              <View style={styles.row}>
                {[true, false].map((v) => {
                  const on = lock.biometrics === v;
                  return (
                    <Pressable
                      key={String(v)}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => turnBio(v)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{v ? "Yes" : "PIN only"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            <Pressable style={styles.outline} onPress={() => setMode("change")} accessibilityRole="button">
              <Text style={styles.outlineText}>Change PIN</Text>
            </Pressable>
            <Pressable style={styles.outline} onPress={() => setMode("off")} accessibilityRole="button">
              <Text style={styles.outlineText}>Turn lock off</Text>
            </Pressable>
          </View>
          <Text style={styles.small}>Forgot your PIN? Tap Forgot your PIN? on the lock screen, log out and sign in again with your password.</Text>
        </>
      )}
      <AppLockSetupModal mode={mode} onClose={() => setMode(null)} />
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  hint: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginBottom: 10 },
  on: { color: "#22C55E", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "600", marginTop: 8, marginBottom: 6 },
  row: { flexDirection: "row", gap: 8, marginBottom: 4 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },
  chipOn: { borderColor: BRAND_GOLD, backgroundColor: "#2A2410" },
  chipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: BRAND_GOLD },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 13, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { flex: 1, borderWidth: 1, borderColor: "#475569", borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: "#E2E8F0", fontWeight: "700", fontSize: 14 },
  small: { color: "#64748B", fontSize: 12, lineHeight: 17, marginTop: 8 },
});
