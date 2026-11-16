import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { registerRootComponent } from "expo";
import App from "./App";

// The Android home-screen calendar widget draws in a background task
// (src/widgets). Builds from before the widget don't have its native code but
// still get this file as an instant update, so check before loading it.
if (Platform.OS === "android") {
  let ready = false;
  try {
    ready = !!(TurboModuleRegistry.get("AndroidWidget") ?? NativeModules.AndroidWidget);
  } catch {
    ready = false;
  }
  if (ready) require("./src/widgets/registerAndroidWidget");
}

registerRootComponent(App);
