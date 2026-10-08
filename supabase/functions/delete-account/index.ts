// Deletes the signed-in client's account, as Apple and Google require apps
// with sign-up to offer. Removes their files from Storage first (database
// cascades can't reach those), then the auth user, which cascades through
// clients and every client_id table.
//
// Deployed with verify_jwt on, and only ever acts on the caller's own user id
// taken from their token, never on an id in the request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Every bucket that stores client files under a `<clientId>/` folder.
const CLIENT_BUCKETS = ["client-avatars", "progress-photos", "training-videos"];

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Not signed in" });
  const userId = userData.user.id;

  // The trainer's account owns every client, so it can't be deleted from here.
  const { data: trainer, error: trainerError } = await admin.from("trainers").select("id").eq("id", userId).maybeSingle();
  if (trainerError) return json(500, { error: trainerError.message });
  if (trainer) return json(403, { error: "The trainer account can't be deleted from the app." });

  for (const bucket of CLIENT_BUCKETS) {
    // Remove in pages until the folder is empty. Entries without an id are
    // sub-folders, which the app never creates, so they're left alone; the cap
    // stops a page that won't delete from looping forever.
    for (let page = 0; page < 50; page++) {
      const { data: entries, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      if (error) return json(500, { error: `Couldn't list ${bucket}: ${error.message}` });
      const files = (entries ?? []).filter((f) => f.id !== null);
      if (files.length === 0) break;
      const { error: removeError } = await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError) return json(500, { error: `Couldn't delete ${bucket}: ${removeError.message}` });
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json(500, { error: deleteError.message });

  return json(200, { deleted: true });
});
