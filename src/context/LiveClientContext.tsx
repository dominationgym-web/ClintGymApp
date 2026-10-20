import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setLiveClient, supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Client } from "@/types/database";

// Live 1-on-1 training (GRIZZ, 2026-10-20): the trainer opens the client's own
// workout screen on their phone. Inside this provider that screen works for
// the client named here instead of the person logged in, and every request
// says so (setLiveClient), which the database only accepts from the client's
// own trainer (acting_client(), 0134).

type Live = { client: Client | null; refreshProfile: () => Promise<void> };

const LiveClientContext = createContext<Live | null>(null);

export function LiveClientProvider({ clientId, children }: { clientId: string; children: React.ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("clients").select("*").eq("id", clientId).single();
    setClient(data ?? null);
  }, [clientId]);
  useEffect(() => {
    setLiveClient(clientId);
    load();
    return () => setLiveClient(null);
  }, [clientId, load]);
  return <LiveClientContext.Provider value={{ client, refreshProfile: load }}>{children}</LiveClientContext.Provider>;
}

/** The client whose workout this is, and whether their trainer is running it live. */
export function useWorkoutClient(): Live & { live: boolean } {
  const live = useContext(LiveClientContext);
  const auth = useAuth();
  return live ? { ...live, live: true } : { client: auth.client, refreshProfile: auth.refreshProfile, live: false };
}
