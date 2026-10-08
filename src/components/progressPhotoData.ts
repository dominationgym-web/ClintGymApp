import { supabase } from "@/lib/supabase";
import { PROGRESS_BUCKET } from "@/lib/progressPhotos";
import type { StripPhoto } from "@/components/PhotoStrip";

// Kept short on purpose: once a client stops sharing, a link the trainer's
// phone already has stops working within a few minutes.
const SIGNED_URL_SECONDS = 5 * 60;

/** A client's progress photos, oldest first, with signed URLs. RLS returns
 * nothing to the trainer unless the client is sharing. */
export async function loadProgressPhotos(clientId: string): Promise<(StripPhoto & { path: string })[]> {
  const { data } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("client_id", clientId)
    .order("taken_on", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from(PROGRESS_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), SIGNED_URL_SECONDS);
  const urls: Record<string, string> = {};
  for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  return rows.map((r) => ({ id: r.id, path: r.storage_path, takenOn: r.taken_on, url: urls[r.storage_path] }));
}

/** Date of the client's latest progress photo, or null if they have none. */
export async function latestProgressPhotoDate(clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from("progress_photos")
    .select("taken_on")
    .eq("client_id", clientId)
    .order("taken_on", { ascending: false })
    .limit(1);
  return data?.[0]?.taken_on ?? null;
}
