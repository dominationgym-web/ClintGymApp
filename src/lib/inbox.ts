import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { clearHandledNotifications } from "@/lib/notifications";
import type { InboxItem } from "@/types/database";

// The 🔔 inbox (0232, GRIZZ 2026-11-21: "messages get lost and can't be
// found"). Every phone notification the server sends is also kept here, so
// clients and trainers can find it again under the bell at the top of the app.

export type { InboxItem };

export { INBOX_PAGE, inboxType, isCoachMessage, inboxIcon, inboxTitle, timeAgo, splitInbox, badgeText } from "@/lib/inboxItems";
import { INBOX_PAGE } from "@/lib/inboxItems";

// ---------------------------------------------------------------------------
// The unread count, shared by every bell on screen
// ---------------------------------------------------------------------------
let unread = 0;
const listeners = new Set<(n: number) => void>();
const changeListeners = new Set<() => void>();

function setUnread(n: number) {
  unread = n;
  listeners.forEach((l) => l(n));
}

export async function refreshInboxUnread(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return setUnread(0);
  const { count } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me)
    .is("read_at", null);
  setUnread(count ?? 0);
}

/** Tells open inbox pages and bells that something arrived or was read. */
export function inboxChanged() {
  changeListeners.forEach((l) => l());
  refreshInboxUnread().catch(() => undefined);
  clearSoon();
}

// Something was marked or read: take dealt-with notifications off the phone.
// Batched, because marking a morning's sessions fires many changes at once.
let clearTimer: ReturnType<typeof setTimeout> | null = null;
function clearSoon() {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    clearTimer = null;
    clearHandledNotifications().catch(() => undefined);
  }, 800);
}

export function onInboxChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

// One live connection for however many bells are mounted.
let watchers = 0;
let stopWatching: (() => void) | null = null;

function startWatching(userId: string) {
  const channel = supabase
    .channel(`inbox-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "inbox_items", filter: `user_id=eq.${userId}` }, () =>
      inboxChanged(),
    )
    .subscribe();
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") inboxChanged();
  });
  return () => {
    supabase.removeChannel(channel);
    sub.remove();
  };
}

/** The live unread count for the signed-in person. */
export function useInboxUnread(userId: string | null | undefined): number {
  const [count, setCount] = useState(unread);
  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);
  useEffect(() => {
    if (!userId) return;
    watchers += 1;
    if (watchers === 1) stopWatching = startWatching(userId);
    refreshInboxUnread().catch(() => undefined);
    return () => {
      watchers -= 1;
      if (watchers === 0 && stopWatching) {
        stopWatching();
        stopWatching = null;
      }
    };
  }, [userId]);
  return count;
}

export async function loadInbox(userId: string): Promise<InboxItem[]> {
  const { data } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(INBOX_PAGE);
  return (data ?? []) as InboxItem[];
}

/** One item, or everything when no id is given. */
export async function markInboxRead(id?: string): Promise<void> {
  await supabase.rpc("mark_inbox_read", { p_id: id ?? null });
  inboxChanged();
}
