import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { syncHealthOnOpen } from "@/lib/healthLink";

// Each time the client opens the app (or comes back to it), last night's sleep
// and any new workouts are read from their linked watch (0124, GRIZZ,
// 2026-10-19: "log their sleep when the clients logs into the app"). Nothing
// happens when no watch is linked.
export default function HealthSyncOnOpen() {
  const { client } = useAuth();
  const clientId = client?.id;
  useEffect(() => {
    if (!clientId) return;
    syncHealthOnOpen(clientId);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncHealthOnOpen(clientId);
    });
    return () => subscription.remove();
  }, [clientId]);
  return null;
}
