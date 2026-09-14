import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Client, Trainer } from "@/types/database";

type Role = "trainer" | "client" | null;

interface AuthContextValue {
  session: Session | null;
  role: Role;
  trainer: Trainer | null;
  client: Client | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (trainerRow) {
      setRole("trainer");
      setTrainer(trainerRow);
      setClient(null);
      return;
    }

    const { data: clientRow } = await supabase
      .from("clients")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (clientRow) {
      setRole("client");
      setClient(clientRow);
      setTrainer(null);
      return;
    }

    // Authenticated but no trainer/client row yet (e.g. mid-signup, before
    // payment confirmation creates the client record).
    setRole(null);
    setTrainer(null);
    setClient(null);
  };

  const refreshProfile = async () => {
    if (session?.user.id) {
      await loadProfile(session.user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user.id) {
        setLoading(true);
        loadProfile(newSession.user.id).finally(() => setLoading(false));
      } else {
        setRole(null);
        setTrainer(null);
        setClient(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({ session, role, trainer, client, loading, signOut, refreshProfile }),
    [session, role, trainer, client, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
