import { supabase } from "@/lib/supabase";

// A live workout opened from a 1 on 1 calendar session (GRIZZ 2026-11-09):
// finishing it also ticks the calendar session as trained, the same as
// "✓ Done, we trained", so the trainer doesn't do it twice. Only sessions
// still booked are marked (a done one would push the client again), and the
// database only allows it from an hour before the start.
export async function markCalendarSessionsTrained(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data } = await supabase.from("live_sessions").select("id, status, starts_at").in("id", ids);
  const soon = Date.now() + 3600000;
  let marked = 0;
  for (const s of data ?? []) {
    if (s.status !== "booked" || new Date(s.starts_at).getTime() > soon) continue;
    const { error } = await supabase.rpc("set_session_outcome", { p_id: s.id, p_outcome: "done" });
    if (!error) marked++;
  }
  return marked;
}
