import type { AccessStatus, Client } from "@/types/database";

// The whole business model runs on `clients.access_status` - see
// docs/access-gating.md. Get it wrong and either a non-paying client gets full
// access or a paying client is locked out, so the decision lives here as a
// plain function that tests can pin down, and RootNavigator just renders it.

export type AppArea =
  | "loading" // still resolving the session and profile
  | "auth" // signed out, or signed in with no trainer/client row yet
  | "trainer"
  | "intake" // active client who hasn't filled in the intake form
  | "client" // active client, full app
  | "pending"; // client whose access isn't active - no app access at all

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
    // `active` is the only status that opens the app. Anything else - and a
    // client row we failed to load - waits on the trainer confirming payment.
    if (client?.access_status !== "active") return "pending";
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
