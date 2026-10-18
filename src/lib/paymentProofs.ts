// Proof of payment through the app (0117, GRIZZ, 2026-10-18): a client sends
// a photo or screenshot of their EFT to their trainer, and a trainer sends
// theirs for app fees to the owner. It arrives linked to the person, so the
// receiver can check it and activate them in one place.
import type { PaymentProof } from "@/types/database";

export const PAYMENT_PROOF_BUCKET = "payment-proofs";

/** A fresh file under the sender's own folder, which the storage rules require. */
export function paymentProofPath(payerId: string, now = Date.now()): string {
  return `${payerId}/${now}.jpg`;
}

/** The newest proof first. */
export function latestProof<T extends Pick<PaymentProof, "created_at">>(proofs: T[]): T | null {
  return [...proofs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

/** Proofs still waiting to be checked, newest per person (client, or trainer for owner proofs). */
export function waitingByPerson(proofs: PaymentProof[]): Record<string, PaymentProof> {
  const out: Record<string, PaymentProof> = {};
  for (const p of proofs) {
    if (p.status !== "new") continue;
    const key = p.to_owner ? p.trainer_id : p.client_id!;
    if (!out[key] || p.created_at > out[key].created_at) out[key] = p;
  }
  return out;
}

/** "18 Oct, 14:05" in the phone's time. */
export function proofWhen(createdAt: string): string {
  const d = new Date(createdAt);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${d.toLocaleDateString("en-ZA", { month: "short" })}, ${time}`;
}

/** What the sender sees about their last proof. */
export function proofStatusText(proof: Pick<PaymentProof, "status" | "created_at">, receiver: string): string {
  if (proof.status === "confirmed") return `✓ ${receiver} confirmed your payment.`;
  if (proof.status === "not_received") return `${receiver} couldn't find this payment yet. Check the details with them, or send a new proof.`;
  return `🧾 Sent ${proofWhen(proof.created_at)}. Waiting for ${receiver} to check it.`;
}
