import { supabase } from "@/lib/supabase";

// Log-in help (GRIZZ, 2026-11-09): a trainer sees their client's log-in email,
// fixes a mistyped one, or gives them a new password. The owner can do the same
// for trainers. The work happens in the login-help Edge Function.
type Result<T> = { data: T | null; error: string | null };

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke("login-help", { body });
  if (error) {
    const message = await (error as { context?: Response }).context
      ?.json()
      .then((b: { error?: string }) => b.error)
      .catch(() => null);
    return { data: null, error: message ?? "Check your internet connection and try again." };
  }
  return { data: data as T, error: null };
}

export const loadLoginEmail = (userId: string) => call<{ email: string | null }>({ action: "get", userId });
export const makeNewPassword = (userId: string) => call<{ email: string | null; password: string }>({ action: "password", userId });
export const fixLoginEmail = (userId: string, email: string) => call<{ email: string }>({ action: "email", userId, email });
