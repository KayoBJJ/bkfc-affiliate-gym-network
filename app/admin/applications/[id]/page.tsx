import { confirmedTestReason } from "@/lib/admin/test-applications";
import { ApplicationGymControls } from "@/components/admin/ApplicationGymControls";
import { getBkfcIntegrationConfig } from "@/lib/config/server";
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
import { CommunicationStatusCard } from "@/components/admin/CommunicationStatusCard";
import { ApplicationPaymentCard } from "@/components/admin/ApplicationPaymentCard";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getAffiliateApplicationById,
  getApplicationAuditEvents,
  getApplicationCommunicationStatus,
  getApplicationInformationRequests,
  getApplicationStageHistory,
  getApplicationPaymentStatus,
  getGymControlStatus,
} from "@/lib/admin/supabase";
import { isApplicantCommunicationsEnabled } from "@/lib/config/server";
import {
  createInformationRequestAction,
  emailApplicantPortalLinkAction,
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
  const [application, stageHistory, auditEvents, informationRequests, communicationStatus, paymentStatus, gymControls] = await Promise.all([
    getAffiliateApplicationById(params.id),
    getApplicationStageHistory(params.id),
    getApplicationAuditEvents(params.id),
    getApplicationInformationRequests(params.id),
    getApplicationCommunicationStatus(params.id),
    getApplicationPaymentStatus(params.id),
    getGymControlStatus(params.id),
  ]);

  if (!application) {
    notFound();
  }

  const delisted = gymControls?.remote?.delisted === true;
  const testReason = confirmedTestReason(application.id);

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

      {testReason && <section className="panel admin-detail-panel"><h2>Confirmed test application</h2><p>{testReason}. Excluded from business totals; retained for audit history.</p></section>}
      {delisted && <section className="panel admin-detail-panel"><h2>Closed / Delisted</h2><p>BKFC has confirmed this listing is delisted. Earlier review and payment events remain visible as history. See the stored BKFC snapshot and internal closure notes below.</p></section>}
      <div className="admin-detail-layout">
        <ApplicationDetailPanel application={application} delisted={delisted} />

        <aside className="admin-review-rail" aria-label="Application review controls">
          <PipelineActionsPanel applicationId={application.id} />

          <ReviewUpdateForm
            applicationId={application.id}
            currentInternalNotes={application.internal_notes}
            action={updateApplicationReviewAction}
          />

          <ApplicantPortalAccessCard
            applicationId={application.id}
            generateAction={issueApplicantPortalLinkAction}
            emailAction={emailApplicantPortalLinkAction}
          />
        </aside>
      </div>

      <div className="admin-follow-up-layout">
        <ApplicationPaymentCard application={application} payment={paymentStatus} delisted={delisted} />
        <ApplicationGymControls applicationId={application.id} controls={gymControls} enabled={getBkfcIntegrationConfig().gymControlDeliveryEnabled} />
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
        <CommunicationStatusCard
          status={communicationStatus}
          enabled={isApplicantCommunicationsEnabled()}
        />
        <StageTimelineCard
          historyEntries={stageHistory}
          auditEvents={auditEvents}
        />
      </div>
    </AdminShell>
  );
}
