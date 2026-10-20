import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in."
  );
}

// Live 1-on-1 training (0134): while a trainer runs a client's workout, every
// request names that client, and the database's acting_client() treats the
// trainer as that client, but only if it's their own client.
let liveClientId: string | null = null;
export function setLiveClient(id: string | null) {
  liveClientId = id;
}
export function getLiveClient(): string | null {
  return liveClientId;
}

const liveFetch: typeof fetch = (input, init) => {
  if (!liveClientId) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set("x-live-client", liveClientId);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: liveFetch },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
