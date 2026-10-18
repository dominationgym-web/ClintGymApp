import { describe, expect, it } from "vitest";
import { latestProof, paymentProofPath, proofStatusText, waitingByPerson } from "@/lib/paymentProofs";
import type { PaymentProof } from "@/types/database";

const proof = (over: Partial<PaymentProof>): PaymentProof => ({
  id: "p",
  payer_id: "c1",
  client_id: "c1",
  trainer_id: "t1",
  to_owner: false,
  storage_path: "c1/1.jpg",
  amount: null,
  note: null,
  status: "new",
  reviewed_at: null,
  created_at: "2026-10-18T10:00:00Z",
  ...over,
});

describe("payment proofs", () => {
  it("files each proof under the sender's own folder", () => {
    expect(paymentProofPath("abc", 5)).toBe("abc/5.jpg");
  });

  it("finds the newest proof", () => {
    expect(latestProof([proof({ id: "a" }), proof({ id: "b", created_at: "2026-10-18T11:00:00Z" })])?.id).toBe("b");
    expect(latestProof([])).toBeNull();
  });

  it("keeps only waiting proofs, newest per client or trainer", () => {
    const map = waitingByPerson([
      proof({ id: "old" }),
      proof({ id: "new", created_at: "2026-10-18T12:00:00Z" }),
      proof({ id: "done", client_id: "c2", status: "confirmed" }),
      proof({ id: "trainer", client_id: null, to_owner: true, trainer_id: "t9" }),
    ]);
    expect(Object.keys(map).sort()).toEqual(["c1", "t9"]);
    expect(map.c1.id).toBe("new");
  });

  it("tells the sender where it stands", () => {
    expect(proofStatusText(proof({ status: "confirmed" }), "Clint")).toBe("✓ Clint confirmed your payment.");
    expect(proofStatusText(proof({ status: "not_received" }), "Clint")).toContain("couldn't find");
    expect(proofStatusText(proof({}), "Clint")).toContain("Waiting for Clint");
  });
});
