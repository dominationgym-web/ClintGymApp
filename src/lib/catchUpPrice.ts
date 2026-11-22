// What a catch-up costs, and why, in plain words for the trainer.
//
// The rule (same as the invoices): a client pays once for each session.
// - They cancelled in time, were away, or didn't come: the missed session
//   stays on their invoice, so the catch-up is free.
// - The trainer cancelled (or blocked out the time): the missed session isn't
//   charged, so the catch-up is charged at that session's price.
// - A pair set up to train together (Clients › 👥 Pairs, or a diary plan with
//   an alone price): alone in the catch-up it's the alone price (GRIZZ
//   2026-11-18: "a single session on a double will always be R750").
//
// Someone else training in the same slot does NOT make it a joint session:
// a catch-up put into a free gap next to another client is still one person
// (GRIZZ 2026-11-22: Jordan's catch-up came up as R750, the trainer's default
// price, when his rate is R650, because Luanne trained at that time).
//
// A missed catch-up that was free follows back to the session it was for, so
// a catch-up for a session the trainer cancelled keeps its price even when
// the client then misses the catch-up itself.

export type CatchUpSession = {
  id: string;
  starts_at: string;
  fee: number | string | null;
  cancelled_by?: string | null;
  away_id?: string | null;
  status?: string | null;
  makeup_for?: string | null;
  client_id?: string | null;
  guest_name?: string | null;
};

export type PairPlan = { fee: number | string | null; group_size?: number | null; solo_fee?: number | string | null };

export type CatchUpCharge = { price: number; why: string };

const num = (x: number | string | null | undefined) => {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** The session the money hangs on: a free catch-up that was missed points back to what it was for. */
export function catchUpRoot<T extends CatchUpSession>(missed: T, sessions: T[]): T {
  let m = missed;
  const seen = new Set<string>([m.id]);
  while (m.makeup_for && num(m.fee) === 0) {
    const o = sessions.find((s) => s.id === m.makeup_for);
    if (!o || seen.has(o.id)) break;
    seen.add(o.id);
    m = o;
  }
  return m;
}

export function catchUpCharge<T extends CatchUpSession>(
  missed: T,
  sessions: T[],
  opts: { plan?: PairPlan | null; money: (n: number) => string; day: (iso: string) => string }
): CatchUpCharge {
  const root = catchUpRoot(missed, sessions);
  const day = opts.day(root.starts_at);
  const chained = root.id !== missed.id;
  if (root.cancelled_by === "trainer") {
    const price = num(root.fee);
    return {
      price,
      why: chained
        ? `You cancelled ${day} and they missed the catch-up for it, so ${day} still hasn't been charged. This catch-up is charged at their price (${opts.money(price)}).`
        : `You cancelled ${day}, so that session isn't charged. This catch-up is charged instead, at their price (${opts.money(price)}).`,
    };
  }
  const plan = opts.plan;
  if (plan && num(plan.group_size) > 1 && plan.solo_fee != null) {
    const price = num(plan.solo_fee);
    return {
      price,
      why: `They train as a pair, so alone in a catch-up it's the alone price (${opts.money(price)}).`,
    };
  }
  const how = missed.away_id ? "were away" : missed.status === "no_show" ? "didn't come" : "cancelled";
  return {
    price: 0,
    why: `Free: they ${how} on ${opts.day(missed.starts_at)} and that session stays on their invoice, so the catch-up is already paid for. If you take it off the catch-up list instead (🟢 Credit), that session comes off their invoice.`,
  };
}
