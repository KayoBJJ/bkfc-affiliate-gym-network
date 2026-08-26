import { triggerPipelineAction } from "@/app/admin/applications/[id]/actions";
import { PipelineActionForm } from "@/components/admin/PipelineActionForm";

type PipelineActionsPanelProps = {
  applicationId: string;
};

type PipelineAction = {
  label: string;
  pendingLabel: string;
  reviewStage: string;
  status: string;
  tone?: "danger";
};

type PipelineGroup = {
  title: string;
  actions: PipelineAction[];
};

const pipelineGroups: PipelineGroup[] = [
  {
    title: "Review Flow",
    actions: [
      {
        label: "Start Review",
        pendingLabel: "Starting review...",
        reviewStage: "under_review",
        status: "in_review",
      },
      {
        label: "Mark for Interview",
        pendingLabel: "Scheduling interview...",
        reviewStage: "interview",
        status: "in_review",
      },
      {
        label: "Mark Trial Candidate",
        pendingLabel: "Updating candidate...",
        reviewStage: "trial_candidate",
        status: "candidate",
      },
    ],
  },
  {
    title: "Approvals",
    actions: [
      {
        label: "Approve Gym",
        pendingLabel: "Approving gym...",
        reviewStage: "approved",
        status: "approved",
      },
      {
        label: "Activate Affiliate",
        pendingLabel: "Activating affiliate...",
        reviewStage: "activated_affiliate",
        status: "active",
      },
    ],
  },
  {
    title: "Close Out",
    actions: [
      {
        label: "Reject",
        pendingLabel: "Rejecting application...",
        reviewStage: "rejected",
        status: "rejected",
        tone: "danger" as const,
      },
    ],
  },
];

export function PipelineActionsPanel({ applicationId }: PipelineActionsPanelProps) {
  return (
    <section className="panel admin-pipeline-panel">
      <div className="section-heading">
        <p className="eyebrow">Pipeline Actions</p>
        <h2>Quick workflow updates</h2>
      </div>

      <div className="admin-pipeline-groups">
        {pipelineGroups.map((group) => (
          <div key={group.title} className="admin-pipeline-group">
            <p className="admin-pipeline-group-label">{group.title}</p>
            <div className="admin-pipeline-grid">
              {group.actions.map((action) => (
                <PipelineActionForm
                  key={action.label}
                  applicationId={applicationId}
                  reviewStage={action.reviewStage}
                  status={action.status}
                  label={action.label}
                  pendingLabel={action.pendingLabel}
                  tone={action.tone}
                  action={triggerPipelineAction}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
