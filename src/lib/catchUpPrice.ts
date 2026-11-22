// What a catch-up costs, and why, in plain words for the trainer.
//
// One rule for everyone (GRIZZ 2026-11-22: "any client that goes to catch-up
// keeps the session so will never be charged for the catch-up. Only if I
// credit the slot due to no slots being available. Keep it standard across
// the board. Variations will confuse the trainers"):
// - On the catch-up list, the missed session stays on their invoice, whoever
//   cancelled (client, away, no-show, or the trainer / a holiday), so the
//   catch-up is always free.
// - 🟢 Credit takes it off the list: the missed session isn't charged (or
//   comes off the next invoice if it was already invoiced).

export type CatchUpSession = {
  id: string;
  starts_at: string;
  cancelled_by?: string | null;
  away_id?: string | null;
  status?: string | null;
};

export type CatchUpCharge = { price: number; why: string };

export function catchUpCharge(missed: CatchUpSession, opts: { day: (iso: string) => string }): CatchUpCharge {
  const how =
    missed.cancelled_by === "trainer" ? "you cancelled" : missed.away_id ? "they were away" : missed.status === "no_show" ? "they didn't come" : "they cancelled";
  return {
    price: 0,
    why: `Free: ${how} on ${opts.day(missed.starts_at)}, and that session stays on their invoice, so the catch-up is already paid for. Can't fit one in? Take it off the catch-up list (🟢 Credit) and that session isn't charged.`,
  };
}
