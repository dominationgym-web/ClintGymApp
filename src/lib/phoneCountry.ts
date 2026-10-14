import type * as LocationModule from "expo-location";

// Which country the phone is in, so a new trainer is charged the right
// prices: rand in South Africa, dollars elsewhere (GRIZZ, 2026-10-14; 0096).
// Only the country code is kept, never the position.
//
// expo-location is a native module. Builds made before it was added don't
// have it, so it's loaded here, inside a try, and a missing module reads as
// "unavailable" instead of crashing the app.
export type CountryCheck =
  | { ok: true; country: string }
  | { ok: false; reason: "denied" | "off" | "unavailable" | "failed" };

export async function phoneCountry(): Promise<CountryCheck> {
  let Location: typeof LocationModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Location = require("expo-location");
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return { ok: false, reason: "denied" };
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: "off" };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const [place] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const country = place?.isoCountryCode?.trim().toUpperCase();
    return country ? { ok: true, country } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** What to tell a trainer when the check didn't work. */
export function countryCheckMessage(reason: "denied" | "off" | "failed"): { title: string; message: string } {
  switch (reason) {
    case "denied":
      return {
        title: "Location needed",
        message:
          "We check your country once so you're charged the right prices. Please allow location for Daily Evolution in your phone's settings, then tap Apply again.",
      };
    case "off":
      return {
        title: "Turn on location",
        message: "Your phone's location is off. Turn it on, then tap Apply again. Only your country is saved.",
      };
    case "failed":
      return {
        title: "Couldn't find your country",
        message: "Check you have signal or Wi-Fi with location on, then tap Apply again.",
      };
  }
}

/** "South Africa" for "ZA", or the code itself if the phone doesn't know the name. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "ZA") return "South Africa";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
