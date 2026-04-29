import "server-only";

import { createAdminSupabaseClient } from "@/lib/admin/supabase";

export async function logStageChange(
  applicationId: string,
  reviewStage: string,
  status: string
) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("application_stage_history").insert({
    application_id: applicationId,
    review_stage: reviewStage,
    status,
    changed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to log stage change: ${error.message}`);
  }
}
