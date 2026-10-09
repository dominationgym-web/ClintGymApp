// Nightly clean-up of training videos past their expires_at (30 days after
// upload). Called by the cleanup-expired-videos-daily pg_cron job (0029),
// because Supabase only lets files be deleted through the Storage API, not
// from SQL. Removes the file, then soft-deletes the row so the trainer's notes
// about the video survive.
//
// Deployed with verify_jwt off; the caller must send the Vault secret in
// x-cron-secret, which only the cron job can read.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "training-videos";
// Storage's remove() takes at most 1000 paths per call.
const PAGE = 500;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok, error: secretError } = await admin.rpc("video_cleanup_secret_ok", { p_secret: secret });
  if (secretError) return json(500, { error: secretError.message });
  if (!secret || ok !== true) return json(401, { error: "Not allowed" });

  let removed = 0;
  // The cap stops a page that won't clear from looping forever.
  for (let page = 0; page < 50; page++) {
    const { data: rows, error } = await admin
      .from("videos")
      .select("id, storage_provider, storage_path")
      .is("deleted_at", null)
      .lt("expires_at", new Date().toISOString())
      .limit(PAGE);
    if (error) return json(500, { error: error.message });
    if (!rows || rows.length === 0) break;

    const paths = rows.filter((r) => r.storage_provider === "supabase").map((r) => r.storage_path);
    if (paths.length > 0) {
      // Paths that are already gone are skipped by Storage, not an error.
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
      if (removeError) return json(500, { error: `Couldn't delete videos: ${removeError.message}` });
    }

    const { error: updateError } = await admin
      .from("videos")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", rows.map((r) => r.id));
    if (updateError) return json(500, { error: updateError.message });
    removed += rows.length;
  }

  return json(200, { removed });
});
