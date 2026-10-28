import { supabase } from "@/lib/supabase";

// "Check in on Nancy" (0156, GRIZZ 2026-10-25): a reminder to the trainer to
// get in touch with clients they haven't spoken to in a few days, so clients
// feel special. Never a message sent for them. Chat happens on WhatsApp, so
// tapping a WhatsApp button for a client counts as being in touch.

/** Days without contact before the nudge (0156's quiet_clients). */
export const QUIET_AFTER_DAYS = 4;

/** The nudge line for one client, e.g. "5 days since you last spoke". */
export function quietLine(daysQuiet: number, lastSpokeAt: string | null): string {
  const days = `${daysQuiet} day${daysQuiet === 1 ? "" : "s"}`;
  return lastSpokeAt ? `${days} since you last spoke` : `Not in touch yet (${days})`;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "them";
}

/** Saves that the trainer got in touch with this client (WhatsApp tap or "Spoke in person"). */
export async function markClientContact(clientId: string): Promise<string | null> {
  const { error } = await supabase.rpc("mark_client_contact", { p_client: clientId });
  return error?.message ?? null;
}
