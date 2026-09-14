"use server";
import { requireAdminUser } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { getBkfcIntegrationConfig } from "@/lib/config/server";
import { GYM_LOGO_BUCKET, validateLogoUploadMetadata, type LogoUploadMetadata } from "@/lib/integrations/bkfc/logo-upload-policy";
export async function prepareGymLogoUpload(metadata: LogoUploadMetadata) {
  const actor = await requireAdminUser();
  if (!getBkfcIntegrationConfig().gymControlDeliveryEnabled) throw new Error("GYM_CONTROL_DELIVERY_DISABLED");
  validateLogoUploadMetadata(metadata);
  const db = createAdminSupabaseClient();
  const { data: path, error } = await db.rpc("prepare_bkfc_control_logo_upload", {
    p_command_id: metadata.commandId, p_application_id: metadata.applicationId, p_version: metadata.version,
    p_content_type: metadata.contentType, p_size_bytes: metadata.size, p_sha256: metadata.sha256, p_actor_user_id: actor.id,
  });
  if (error || typeof path !== "string") throw new Error("LOGO_UPLOAD_PREPARATION_FAILED");
  const signed = await db.storage.from(GYM_LOGO_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) throw new Error("LOGO_UPLOAD_PREPARATION_FAILED");
  return { path, token: signed.data.token };
}
