import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";

// GRIZZ, 2026-11-04: testers installing from Google Play or TestFlight saw
// old screens, because a fresh install runs the code built into the app and
// only picks up the newest update on a later open. Whenever the app is
// running its built-in code, it first loads the newest update (up to 12
// seconds, then it carries on with what it has so nobody is stuck offline).
const WAIT_MS = 12000;

function needsCheck() {
  return Platform.OS !== "web" && Updates.isEnabled && Updates.isEmbeddedLaunch;
}

export default function FirstOpenUpdate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(needsCheck);

  useEffect(() => {
    if (!checking) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setChecking(false);
      }
    };
    const timer = setTimeout(finish, WAIT_MS);
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return finish();
        const fetched = await Updates.fetchUpdateAsync();
        if (done) return; // Too slow: it loads on the next open instead.
        if (fetched.isNew) {
          await Updates.reloadAsync();
          return;
        }
        finish();
      } catch {
        finish();
      }
    })();
    return () => clearTimeout(timer);
  }, [checking]);

  if (!checking) return <>{children}</>;
  return (
    <View style={styles.page}>
      <Image source={require("../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={BRAND_GOLD} />
      <Text style={styles.text}>Getting the newest version…</Text>
    </View>
  );
}

const styles = themedStyles({
  page: { flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  logo: { width: 160, height: 160 },
  text: { color: "#94A3B8", fontSize: 15 },
});
