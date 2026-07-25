import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ApplicationDetailPanel } from "@/components/admin/ApplicationDetailPanel";
import { PipelineActionsPanel } from "@/components/admin/PipelineActionsPanel";
import { ReviewUpdateForm } from "@/components/admin/ReviewUpdateForm";
import { StageTimelineCard } from "@/components/admin/StageTimelineCard";
import { InformationRequestForm } from "@/components/admin/InformationRequestForm";
import { InformationRequestsCard } from "@/components/admin/InformationRequestsCard";
import { ApplicantPortalAccessCard } from "@/components/admin/ApplicantPortalAccessCard";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getAffiliateApplicationById,
  getApplicationAuditEvents,
  getApplicationInformationRequests,
  getApplicationStageHistory,
} from "@/lib/admin/supabase";
import {
  createInformationRequestAction,
  issueApplicantPortalLinkAction,
  reissueInformationResponseLinkAction,
  reviewInformationAttachmentAction,
  updateApplicationReviewAction,
} from "./actions";

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
  const [application, stageHistory, auditEvents, informationRequests] = await Promise.all([
    getAffiliateApplicationById(params.id),
    getApplicationStageHistory(params.id),
    getApplicationAuditEvents(params.id),
    getApplicationInformationRequests(params.id),
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

        <aside className="admin-review-rail" aria-label="Application review controls">
          <PipelineActionsPanel applicationId={application.id} />

          <ReviewUpdateForm
            applicationId={application.id}
            currentInternalNotes={application.internal_notes}
            action={updateApplicationReviewAction}
          />

          <ApplicantPortalAccessCard
            applicationId={application.id}
            action={issueApplicantPortalLinkAction}
          />
        </aside>
      </div>

      <div className="admin-follow-up-layout">
        <InformationRequestForm
          applicationId={application.id}
          action={createInformationRequestAction}
        />

        <InformationRequestsCard
          requests={informationRequests}
          applicationId={application.id}
          reviewAttachmentAction={reviewInformationAttachmentAction}
          reissueResponseLinkAction={reissueInformationResponseLinkAction}
        />
      </div>

      <div className="admin-audit-layout">
        <StageTimelineCard
          historyEntries={stageHistory}
          auditEvents={auditEvents}
        />
      </div>
    </AdminShell>
  );
}
