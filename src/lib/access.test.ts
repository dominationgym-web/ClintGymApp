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

  it("gives an active client with a completed intake the full app", () => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client("active") })).toBe("client");
  });

  it("sends an active client with no intake answers to the intake form", () => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client("active", {}) })).toBe("intake");
  });

  // The money test: nothing but `active` may open the app.
  it.each<AccessStatus>(["expired", "expiring_soon"])("locks a %s client out of the app", (status) => {
    expect(resolveAppArea({ ...signedIn, role: "client", client: client(status) })).toBe("pending");
  });

  it("locks a client out when their row could not be loaded", () => {
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
