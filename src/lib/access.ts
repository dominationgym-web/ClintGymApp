import type { AccessStatus, Client } from "@/types/database";

// The whole business model runs on `clients.access_status` - see
// docs/access-gating.md. Get it wrong and either a non-paying client gets full
// access or a paying client is locked out, so the decision lives here as a
// plain function that tests can pin down, and RootNavigator just renders it.
//
// "Has access" means `access_status <> 'expired'`, which covers both `active`
// and `expiring_soon`. `expiring_soon` is a client who is still paid up and
// inside their renewal window - the scheduled auto_expire_plans job sets it 7
// days before `plan_expires_at` - so treating it as a lockout would shut
// paying clients out of the last week of every plan. This mirrors
// `public.client_has_access` in the database, and the two must stay in step.

export type AppArea =
  | "loading" // still resolving the session and profile
  | "auth" // signed out, or signed in with no trainer/client row yet
  | "trainer"
  | "intake" // client with access who hasn't filled in the intake form
  | "client" // client with access, full app
  | "pending"; // expired or unknown client - no app access at all

export type AccessInput = {
  loading: boolean;
  hasSession: boolean;
  role: "trainer" | "client" | null;
  client: Pick<Client, "access_status" | "intake_responses"> | null;
};

export function resolveAppArea({ loading, hasSession, role, client }: AccessInput): AppArea {
  if (loading) return "loading";
  if (!hasSession) return "auth";
  if (role === "trainer") return "trainer";

  if (role === "client") {
    // Only `expired` closes the app. A client row we failed to load also waits
    // on the pending screen rather than being let in - failing closed is the
    // safe direction.
    if (client == null || client.access_status === "expired") return "pending";
    return hasCompletedIntake(client) ? "client" : "intake";
  }

  return "auth";
}

export function hasCompletedIntake(client: Pick<Client, "intake_responses">): boolean {
  return Object.keys(client.intake_responses ?? {}).length > 0;
}

// The trainer taps a client's status pill to move them through this cycle,
// after confirming an EFT/PayPal payment landed. Deliberately starts at
// `expired` so an unrecognised value can never cycle into `active`.
export const ACCESS_STATUS_CYCLE: readonly AccessStatus[] = ["expired", "expiring_soon", "active"];

export function nextAccessStatus(current: AccessStatus): AccessStatus {
  const index = ACCESS_STATUS_CYCLE.indexOf(current);
  return ACCESS_STATUS_CYCLE[(index + 1) % ACCESS_STATUS_CYCLE.length];
}
