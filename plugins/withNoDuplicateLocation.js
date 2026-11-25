// react-native-ble-plx adds <uses-permission-sdk-23> location lines capped at
// Android 11 (maxSdkVersion 30), but the app already asks for location on every
// Android (trainer sign-up country check). Google Play refuses the bundle when
// the same permission is declared twice with different maxSdkVersions
// (2026-11-25), so the capped copies are taken out.
const { withAndroidManifest } = require("@expo/config-plugins");

const LOCATION = ["android.permission.ACCESS_COARSE_LOCATION", "android.permission.ACCESS_FINE_LOCATION"];

module.exports = function withNoDuplicateLocation(config) {
  return withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    if (Array.isArray(m["uses-permission-sdk-23"])) {
      m["uses-permission-sdk-23"] = m["uses-permission-sdk-23"].filter((p) => !LOCATION.includes(p.$["android:name"]));
    }
    return c;
  });
};
