import { Platform } from "react-native";

// Fingerprint / Face ID through expo-local-authentication. Phones on a build
// from before the app lock don't have the native part, and requiring a missing
// native module crashes the app (see calendarImport.ts), so we check first.
// Without it, the lock simply uses the PIN.

type LocalAuth = typeof import("expo-local-authentication");
let mod: LocalAuth | null | undefined;

function localAuth(): LocalAuth | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === "web") return null;
  try {
    const modules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
    if (!modules || modules.ExpoLocalAuthentication == null) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-local-authentication") as LocalAuth;
  } catch {
    mod = null;
  }
  return mod;
}

export type BiometricKind = "face" | "fingerprint" | "other";

/** What this phone can do, or null when it has no fingerprint/face set up (or the app build can't use it). */
export async function biometricKind(): Promise<BiometricKind | null> {
  const la = localAuth();
  if (!la) return null;
  try {
    const [hardware, enrolled] = await Promise.all([la.hasHardwareAsync(), la.isEnrolledAsync()]);
    if (!hardware || !enrolled) return null;
    const types = await la.supportedAuthenticationTypesAsync();
    if (types.includes(la.AuthenticationType.FINGERPRINT)) return "fingerprint";
    if (types.includes(la.AuthenticationType.FACIAL_RECOGNITION)) return "face";
    return "other";
  } catch {
    return null;
  }
}

export function biometricName(kind: BiometricKind | null): string {
  if (kind === "face") return Platform.OS === "ios" ? "Face ID" : "face unlock";
  if (kind === "fingerprint") return Platform.OS === "ios" ? "Touch ID" : "fingerprint";
  return "fingerprint or face";
}

/** Shows the phone's own fingerprint / Face ID prompt. True when it was them. */
export async function askBiometrics(promptMessage: string): Promise<boolean> {
  const la = localAuth();
  if (!la) return false;
  try {
    const result = await la.authenticateAsync({
      promptMessage,
      cancelLabel: "Use PIN",
      // Our own PIN pad is the back-up, not the phone's passcode.
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
