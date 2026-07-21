import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET } from "./policy";
import type { IssuedUpload } from "./direct-upload-contract";

export async function cleanupExpiredUploadSessions(supabase: SupabaseClient<any>, limit = 20) {
  const { data: sessions, error } = await supabase
    .from("affiliate_application_upload_sessions")
    .select("id,upload_manifest")
    .in("status", ["pending", "finalizing", "failed"])
    .lt("expires_at", new Date().toISOString())
    .limit(limit);
  if (error || !sessions?.length) return { sessions: 0, objects: 0, failed: Boolean(error) };

  let objects = 0;
  let failed = false;
  for (const session of sessions) {
    const paths = (session.upload_manifest as IssuedUpload[])
      .map((item) => item.path)
      .filter((path) => typeof path === "string");
    if (paths.length) {
      const result = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      if (result.error) {
        failed = true;
        continue;
      }
      objects += paths.length;
    }
    const update = await supabase.from("affiliate_application_upload_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .in("status", ["pending", "finalizing", "failed"]);
    if (update.error) failed = true;
  }
  return { sessions: sessions.length, objects, failed };
}
