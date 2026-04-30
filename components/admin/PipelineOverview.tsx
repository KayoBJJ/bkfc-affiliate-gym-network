"use client";

import { getStageClass } from "@/lib/admin/formatLabel";

type PipelineOverviewProps = {
  counts: Record<string, number>;
  activeStage: string;
  onStageSelect: (stage: string) => void;
};

const pipelineCards = [
  {
    label: "Total Applications",
    value: "",
    supportingText: "all visible pipeline",
  },
] as const;

const pipelineGroups = [
  {
    label: "Early Pipeline",
    cards: [
      {
        label: "Submitted",
        value: "submitted",
        supportingText: "pipeline stage",
      },
      {
        label: "In Review",
        value: "under_review",
        supportingText: "pipeline stage",
      },
      {
        label: "Follow-Up",
        value: "follow_up_required",
        supportingText: "pipeline stage",
      },
    ],
  },
  {
    label: "Evaluation",
    cards: [
      {
        label: "Interview",
        value: "interview",
        supportingText: "pipeline stage",
      },
      {
        label: "Trial Candidates",
        value: "trial_candidate",
        supportingText: "pipeline stage",
      },
    ],
  },
  {
    label: "Conversion",
    cards: [
      {
        label: "Approved",
        value: "approved",
        supportingText: "pipeline stage",
      },
      {
        label: "Active",
        value: "activated_affiliate",
        supportingText: "pipeline stage",
      },
    ],
  },
  {
    label: "Exit",
    cards: [
      {
        label: "Rejected",
        value: "rejected",
        supportingText: "pipeline stage",
      },
    ],
  },
] as const;

export function PipelineOverview({
  counts,
  activeStage,
  onStageSelect,
}: PipelineOverviewProps) {
  return (
    <section className="panel admin-pipeline-overview-panel">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Pipeline Overview</p>
          <h2>Affiliate expansion command center</h2>
          <p className="admin-overview-copy">
            Scan the funnel instantly, then click a stage to focus the table.
          </p>
        </div>
      </div>

      <div className="admin-pipeline-overview-summary">
        {pipelineCards.map((card) => {
          const isAll = card.value === "";
          const count = isAll ? counts.all ?? 0 : counts[card.value] ?? 0;
          const isActive = activeStage === card.value;
          const stageClass = isAll ? "stage-default" : getStageClass(card.value);

          return (
            <button
              key={card.label}
              type="button"
              className={`admin-pipeline-kpi-card ${stageClass}${isActive ? " active" : ""}`}
              onClick={() => onStageSelect(card.value)}
            >
              <span className="admin-pipeline-kpi-label">{card.label}</span>
              <span className="admin-pipeline-kpi-value">{count}</span>
              <span className="admin-pipeline-kpi-support">{card.supportingText}</span>
            </button>
          );
        })}
      </div>

      <div className="admin-pipeline-flow">
        {pipelineGroups.map((group, groupIndex) => (
          <section key={group.label} className="admin-pipeline-flow-group">
            <div className="admin-pipeline-flow-header">
              <p className="admin-pipeline-flow-label">{group.label}</p>
              {groupIndex < pipelineGroups.length - 1 ? (
                <span className="admin-pipeline-flow-arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
            </div>

            <div className="admin-pipeline-overview-grid">
              {group.cards.map((card) => {
                const count = counts[card.value] ?? 0;
                const isActive = activeStage === card.value;
                const stageClass = getStageClass(card.value);

                return (
                  <button
                    key={card.label}
                    type="button"
                    className={`admin-pipeline-kpi-card ${stageClass}${
                      isActive ? " active" : ""
                    }`}
                    onClick={() => onStageSelect(card.value)}
                  >
                    <span className="admin-pipeline-kpi-label">{card.label}</span>
                    <span className="admin-pipeline-kpi-value">{count}</span>
                    <span className="admin-pipeline-kpi-support">{card.supportingText}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
