import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ApplicationDetailPanel } from "@/components/admin/ApplicationDetailPanel";
import { PipelineActionsPanel } from "@/components/admin/PipelineActionsPanel";
import { ReviewUpdateForm } from "@/components/admin/ReviewUpdateForm";
import { StageTimelineCard } from "@/components/admin/StageTimelineCard";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getAffiliateApplicationById,
  getApplicationStageHistory,
} from "@/lib/admin/supabase";
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
  const [application, stageHistory] = await Promise.all([
    getAffiliateApplicationById(params.id),
    getApplicationStageHistory(params.id),
  ]);

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

        <div className="admin-detail-sidebar">
          <PipelineActionsPanel applicationId={application.id} />

          <ReviewUpdateForm
            applicationId={application.id}
            currentInternalNotes={application.internal_notes}
            action={updateApplicationReviewAction}
          />

          <StageTimelineCard historyEntries={stageHistory} />
        </div>
      </div>
    </AdminShell>
  );
}
