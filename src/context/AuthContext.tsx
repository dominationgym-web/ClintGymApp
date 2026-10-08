import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
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

  // The client row is the access gate, so it must not go stale while the app is
  // open. It used to be loaded once per session and never refetched, so a
  // trainer confirming payment left the client stuck on PendingAccessScreen
  // until they force-quit the app, and a revoked client kept the tabs
  // indefinitely. (Since 0022 the database refuses a lapsed client's writes
  // either way, but the UI should agree with the server.)
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = session?.user.id ?? null;
  }, [session]);

  // Refetch whenever the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && userIdRef.current) {
        loadProfile(userIdRef.current);
      }
    });
    return () => subscription.remove();
  }, []);

  // And live, while the app stays open, so an activation lands the moment the
  // trainer taps it. Needs public.clients in the realtime publication (0024);
  // if realtime is unavailable this simply never fires and the foreground
  // refresh above still covers it.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || role !== "client") return;

    const channel = supabase
      .channel(`client-row-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients", filter: `id=eq.${userId}` },
        // Refetch rather than trusting the payload: this row decides what the
        // client can open, so it is worth one round trip to load it the same
        // way every other path does.
        () => loadProfile(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, role]);

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
