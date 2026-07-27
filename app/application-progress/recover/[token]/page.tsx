import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import {
  APPLICANT_PORTAL_VALID_DAYS,
  generateApplicantPortalToken,
  hashApplicantPortalRecoveryToken,
  hashApplicantPortalToken,
} from "@/lib/application/applicant-portal";
import {
  isApplicantPortalEnabled,
  isApplicantPortalRecoveryEnabled,
} from "@/lib/config/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConsumeApplicantPortalRecoveryPage({
  params,
}: {
  params: { token: string };
}) {
  noStore();
  if (!isApplicantPortalEnabled() || !isApplicantPortalRecoveryEnabled()) {
    notFound();
  }
  const recoveryTokenHash = hashApplicantPortalRecoveryToken(params.token);
  const portalToken = generateApplicantPortalToken();
  const portalTokenHash = hashApplicantPortalToken(portalToken);
  if (!recoveryTokenHash || !portalTokenHash) notFound();
  const expiresAt = new Date(
    Date.now() + APPLICANT_PORTAL_VALID_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await createAdminSupabaseClient().rpc(
    "consume_affiliate_application_portal_recovery",
    {
      p_recovery_token_hash: recoveryTokenHash,
      p_portal_token_hash: portalTokenHash,
      p_portal_expires_at: expiresAt,
    },
  );
  if (error || typeof data !== "string") notFound();
  redirect(`/application-progress/${portalToken}`);
}
