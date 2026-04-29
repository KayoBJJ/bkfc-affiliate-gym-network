import { triggerPipelineAction } from "@/app/admin/applications/[id]/actions";

type PipelineActionsPanelProps = {
  applicationId: string;
};

const pipelineActions = [
  {
    label: "Start Review",
    reviewStage: "under_review",
    status: "in_review",
  },
  {
    label: "Request Follow-Up",
    reviewStage: "follow_up_required",
    status: "pending_info",
  },
  {
    label: "Mark for Interview",
    reviewStage: "interview",
    status: "in_review",
  },
  {
    label: "Mark Trial Candidate",
    reviewStage: "trial_candidate",
    status: "candidate",
  },
  {
    label: "Approve Gym",
    reviewStage: "approved",
    status: "approved",
  },
  {
    label: "Activate Affiliate",
    reviewStage: "activated_affiliate",
    status: "active",
  },
  {
    label: "Reject",
    reviewStage: "rejected",
    status: "rejected",
    tone: "danger" as const,
  },
];

export function PipelineActionsPanel({ applicationId }: PipelineActionsPanelProps) {
  return (
    <section className="panel admin-pipeline-panel">
      <div className="section-heading">
        <p className="eyebrow">Pipeline Actions</p>
        <h2>Quick workflow updates</h2>
      </div>

      <div className="admin-pipeline-grid">
        {pipelineActions.map((action) => (
          <form key={action.label} action={triggerPipelineAction} className="admin-pipeline-form">
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="review_stage" value={action.reviewStage} />
            <input type="hidden" name="status" value={action.status} />
            <button
              type="submit"
              className={`secondary-button admin-pipeline-button${
                action.tone === "danger" ? " danger" : ""
              }`}
            >
              {action.label}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
