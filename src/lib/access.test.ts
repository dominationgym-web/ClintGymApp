import { describe, expect, it } from "vitest";
import { ACCESS_STATUS_CYCLE, nextAccessStatus, resolveAppArea } from "@/lib/access";
import type { AccessStatus, Client } from "@/types/database";

type ClientFields = Pick<Client, "access_status" | "intake_responses">;

function client(access_status: AccessStatus, intake_responses: Record<string, string> = { goal: "lose fat" }): ClientFields {
  return { access_status, intake_responses };
}

const signedIn = { loading: false, hasSession: true };

describe("resolveAppArea", () => {
  it("waits while the session and profile are still loading", () => {
    expect(resolveAppArea({ loading: true, hasSession: false, role: null, client: null })).toBe("loading");
    // Loading wins even once a session is known, so no screen flashes first.
    expect(resolveAppArea({ loading: true, hasSession: true, role: "client", client: client("active") })).toBe("loading");
  });

  it("sends a signed-out visitor to the auth screens", () => {
    expect(resolveAppArea({ loading: false, hasSession: false, role: null, client: null })).toBe("auth");
  });

  it("gives a trainer the trainer app regardless of any client row", () => {
    expect(resolveAppArea({ ...signedIn, role: "trainer", client: null })).toBe("trainer");
  });

  // The money test, both ways round: a paying client must get in, and a
  // lapsed one must not. This mirrors `public.client_has_access` in migration
  // 0022, which gates client writes on `access_status <> 'expired'`.
  it.each<AccessStatus>(["active", "expiring_soon"])("gives a %s client the full app", (status) => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client(status) })).toBe("client");
  });

  it("locks an expired client out of the app", () => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client("expired") })).toBe("pending");
  });

  // auto_expire_plans (migration 0021) moves a client to `expiring_soon` seven
  // days before plan_expires_at. They have paid for those seven days, so
  // treating that status as a lockout would shut every client out of the last
  // week of their plan.
  it("keeps a client in their renewal window inside the app", () => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client("expiring_soon") })).toBe("client");
  });

  it.each<AccessStatus>(["active", "expiring_soon"])("sends a %s client with no intake answers to the form", (status) => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client(status, {}) })).toBe("intake");
  });

  it("locks a client out when their row could not be loaded", () => {
    // Failing closed is the safe direction when we can't read the status.
    expect(resolveAppArea({ ...signedIn, role: "client", client: null })).toBe("pending");
  });

  it("does not let a missing intake form bypass the access check", () => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client("expired", {}) })).toBe("pending");
  });

  it("sends a signed-in user with no profile row back to auth", () => {
    // Mid-signup: authenticated, but no trainer or client record yet.
    expect(resolveAppArea({ ...signedIn, role: null, client: null })).toBe("auth");
  });
});

describe("nextAccessStatus", () => {
  it("cycles expired to expiring_soon to active and back", () => {
    expect(nextAccessStatus("expired")).toBe("expiring_soon");
    expect(nextAccessStatus("expiring_soon")).toBe("active");
    expect(nextAccessStatus("active")).toBe("expired");
  });

  it("returns to the starting status after a full cycle", () => {
    const full = ACCESS_STATUS_CYCLE.reduce<AccessStatus>((s) => nextAccessStatus(s), "expired");
    expect(full).toBe("expired");
  });

  it("never lands on active from an unrecognised status", () => {
    // Guards against a new status being added to the database but not here.
    expect(nextAccessStatus("something_new" as AccessStatus)).toBe("expired");
  });
});
