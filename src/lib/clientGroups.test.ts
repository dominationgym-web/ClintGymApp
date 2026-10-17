import { describe, expect, it } from "vitest";
import { clientGroup } from "@/lib/clientGroups";

const today = "2026-10-17";
const base = {
  access_status: "active" as const,
  archived_at: null,
  plan_started_at: "2026-10-01",
  plan_expires_at: "2026-11-01",
  returned_at: null,
};

describe("clientGroup", () => {
  it("puts active and expiring-soon clients under Active", () => {
    expect(clientGroup(base, today)).toBe("active");
    expect(clientGroup({ ...base, access_status: "expiring_soon" }, today)).toBe("active");
  });

  it("puts new sign-ups who were never activated under Waiting approval", () => {
    expect(clientGroup({ ...base, access_status: "expired", plan_started_at: null, plan_expires_at: null }, today)).toBe("approval");
  });

  it("puts clients brought back from the archive under Waiting approval until activated", () => {
    const back = { ...base, access_status: "expired" as const, plan_started_at: "2026-01-01", plan_expires_at: "2026-02-01", returned_at: "2026-10-16T08:00:00Z" };
    expect(clientGroup(back, today)).toBe("approval");
    expect(clientGroup({ ...back, access_status: "active", plan_started_at: "2026-10-16" }, today)).toBe("active");
  });

  it("puts a plan that ended in the last 30 days under Awaiting payment", () => {
    expect(clientGroup({ ...base, access_status: "expired", plan_expires_at: "2026-10-01" }, today)).toBe("payment");
    // Marked expired by hand before the end date.
    expect(clientGroup({ ...base, access_status: "expired" }, today)).toBe("payment");
  });

  it("puts archived clients and plans that ended over 30 days ago under Dormant", () => {
    expect(clientGroup({ ...base, archived_at: "2026-10-10T00:00:00Z" }, today)).toBe("dormant");
    expect(clientGroup({ ...base, access_status: "expired", plan_expires_at: "2026-09-01" }, today)).toBe("dormant");
  });
});
