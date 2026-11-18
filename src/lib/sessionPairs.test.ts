import { describe, expect, it } from "vitest";
import { invoicePair, invoiceSide, invoiceTitle, pairOf, pairTitle, suggestPairs } from "./sessionPairs";
import type { LiveSession, SessionInvoice, SessionPair } from "@/types/database";

type Row = Pick<LiveSession, "client_id" | "guest_name" | "status" | "starts_at">;

const pair = (over: Partial<SessionPair> = {}): SessionPair => ({
  id: "p1",
  trainer_id: "t",
  a_client: "dave",
  a_key: null,
  a_name: "Dave Campbell",
  b_client: "sharde",
  b_key: null,
  b_name: "Sharde Visagie",
  together: 1000,
  alone: 750,
  one_invoice: true,
  payer: "a",
  ended_at: null,
  created_at: "",
  updated_at: "",
  ...over,
});
const jade = pair({ id: "p2", a_client: null, a_key: "jade", a_name: "Jade", b_client: "camilla", b_name: "Camilla Da Costa", together: 900 });

const inv = (over: Partial<SessionInvoice>): SessionInvoice =>
  ({ id: "i", trainer_id: "t", client_id: null, month: "2026-11-01", lines: [], total: 0, status: "draft", ...over }) as SessionInvoice;

describe("pairs", () => {
  it("finds a person's pair by client or calendar name", () => {
    expect(pairOf([pair(), jade], { clientId: "sharde" })?.id).toBe("p1");
    expect(pairOf([pair(), jade], { clientId: null, name: " JADE " })?.id).toBe("p2");
    expect(pairOf([pair({ ended_at: "2026-11-01" })], { clientId: "dave" })).toBeUndefined();
    expect(pairTitle(jade)).toBe("Jade & Camilla");
  });

  it("knows which pair and side an invoice is", () => {
    const i = inv({ client_id: null, guest_key: "jade", guest_name: "Jade" });
    expect(invoicePair([pair(), jade], i)?.id).toBe("p2");
    expect(invoiceSide(jade, i)).toBe("a");
    expect(invoiceSide(pair(), inv({ client_id: "sharde" }))).toBe("b");
  });

  it("titles a couple's invoice with both names, payer first", () => {
    const lines = [
      { id: "1", who: "Sharde Visagie", at: "", kind: "done" },
      { id: "2", who: "Dave Campbell", at: "", kind: "done" },
    ] as SessionInvoice["lines"];
    expect(invoiceTitle(inv({ lines }), "Dave Campbell")).toBe("Dave & Sharde");
    expect(invoiceTitle(inv({ lines: lines.slice(0, 1) }), "Sharde Visagie")).toBe("Sharde Visagie");
  });

  it("suggests people who keep sharing a slot", () => {
    const at = (d: number) => `2026-11-${String(d).padStart(2, "0")}T05:00:00+00:00`;
    const sessions: Row[] = [2, 3, 5, 6].flatMap((d): Row[] => [
      { client_id: "camilla", guest_name: null, status: "done", starts_at: at(d) },
      { client_id: null, guest_name: "Jade", status: "done", starts_at: at(d) },
    ]);
    // A slot with three people isn't a pair.
    sessions.push({ client_id: "bob", guest_name: null, status: "done", starts_at: at(2) });
    const names: Record<string, string> = { camilla: "Camilla Da Costa", bob: "Bob" };
    const s = suggestPairs(sessions, (id) => names[id], []);
    expect(s).toHaveLength(1);
    expect(s[0].n).toBe(3);
    expect([s[0].a.name, s[0].b.name]).toEqual(["Camilla Da Costa", "Jade"]);
    // Already a pair: no suggestion.
    expect(suggestPairs(sessions, (id) => names[id], [jade])).toHaveLength(0);
  });
});
