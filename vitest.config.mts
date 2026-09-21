import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// These are unit tests over the plain logic in src/lib - no React Native
// renderer, no Expo, no network. That keeps the setup to one dev dependency
// and the suite to well under a second.
export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The clients are in South Africa. Defaulting to their timezone rather
    // than UTC means date bugs show up locally and in CI, not in production.
    env: { TZ: "Africa/Johannesburg" },
  },
});
