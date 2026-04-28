import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ApplicationDetailPanel } from "@/components/admin/ApplicationDetailPanel";
import { ReviewUpdateForm } from "@/components/admin/ReviewUpdateForm";
import {
  APPLICATION_STATUS_OPTIONS,
  REVIEW_STAGE_OPTIONS,
} from "@/lib/admin/constants";
import { requireAdminUser } from "@/lib/admin/auth";
import { getAffiliateApplicationById } from "@/lib/admin/supabase";
import { updateApplicationReviewAction } from "./actions";

export const dynamic = "force-dynamic";

type AdminApplicationDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function AdminApplicationDetailPage({
  params,
}: AdminApplicationDetailPageProps) {
  await requireAdminUser();
  const application = await getAffiliateApplicationById(params.id);

  if (!application) {
    notFound();
  }

  return (
    <AdminShell
      title="Application Review"
      description="Inspect submission details, attached assets, and the current review state."
    >
      <div className="admin-detail-actions">
        <Link href="/admin/applications" className="secondary-button admin-back-link">
          Back to applications
        </Link>
      </div>

      <div className="admin-detail-layout">
        <ApplicationDetailPanel application={application} />

        <ReviewUpdateForm
          applicationId={application.id}
          currentStatus={application.status}
          currentReviewStage={application.review_stage}
          currentInternalNotes={application.internal_notes}
          reviewStageOptions={REVIEW_STAGE_OPTIONS}
          statusOptions={APPLICATION_STATUS_OPTIONS}
          action={updateApplicationReviewAction}
        />
      </div>
    </AdminShell>
  );
}
