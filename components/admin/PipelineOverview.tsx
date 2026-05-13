"use client";

import { getStageClass } from "@/lib/admin/formatLabel";

type PipelineOverviewProps = {
  counts: Record<string, number>;
  conversionRates: Record<string, number>;
  stageFriction?: Record<string, StageFriction>;
  weeklyNew: number;
  weeklyGrowth: number;
  activeStage: string;
  onStageSelect: (stage: string) => void;
};

type StageFriction = {
  stuckCount: number;
  averageDaysInStage: number;
  frictionLevel: "healthy" | "slowing" | "stuck";
};

const pipelineGroups = [
  {
    label: "New Applications",
    cards: [
      { label: "New Submission", value: "submitted" },
      { label: "Internal Review", value: "under_review" },
      { label: "Needs Follow-Up", value: "follow_up_required" },
    ],
  },
  {
    label: "Under Review",
    cards: [
      { label: "Interview Scheduled", value: "interview" },
      { label: "Trial Candidate Pool", value: "trial_candidate" },
    ],
  },
  {
    label: "Approved",
    cards: [
      { label: "Approved Pending Activation", value: "approved" },
      { label: "Active Affiliate", value: "activated_affiliate" },
    ],
  },
  {
    label: "Archived",
    cards: [{ label: "Rejected / Archived", value: "rejected" }],
  },
] as const;

function getFrictionLabel(level: StageFriction["frictionLevel"]) {
  if (level === "stuck") return "Escalation Risk";
  if (level === "slowing") return "Slowing";
  return "Stable Flow";
}

export function PipelineOverview({
  counts,
  conversionRates,
  stageFriction = {},
  weeklyNew,
  weeklyGrowth,
  activeStage,
  onStageSelect,
}: PipelineOverviewProps) {
  const bottleneckStage =
    Object.entries(stageFriction)
      .filter(([, friction]) => friction.stuckCount > 0)
      .sort((a, b) => b[1].stuckCount - a[1].stuckCount)[0]?.[0] ?? "";

  const conversionRate = counts.all
    ? Math.round(((counts.approved ?? 0) / counts.all) * 100)
    : 0;

  const activationRate =
    (counts.approved ?? 0) > 0
      ? `${Math.round(((counts.activated_affiliate ?? 0) / (counts.approved ?? 0)) * 100)}%`
      : "-";

  return (
    <section className="panel admin-pipeline-overview-panel">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Pipeline Overview</p>
          <h2>Affiliate Pipeline Status</h2>
          <p className="admin-overview-copy">
            Scan the funnel instantly, then click a stage to focus the table.
          </p>
        </div>
      </div>

      <div className="admin-pipeline-command-grid">
        <button
          type="button"
          className={`admin-pipeline-kpi-card stage-default admin-pipeline-total-card${
            activeStage === "" ? " active" : ""
          }`}
          onClick={() => onStageSelect("")}
        >
          <span className="admin-pipeline-kpi-label">Total Applications</span>
          <span className="admin-pipeline-kpi-value">{counts.all ?? 0}</span>
          <span className="admin-pipeline-kpi-rate">100% of visible pipeline</span>
          <span className="admin-pipeline-kpi-support">
            +{weeklyNew} this week{" "}
            <span
              className={`admin-pipeline-growth ${
                weeklyGrowth > 0
                  ? "positive"
                  : weeklyGrowth < 0
                  ? "negative"
                  : "neutral"
              }`}
            >
              {weeklyGrowth > 0 ? "↑" : weeklyGrowth < 0 ? "↓" : ""}
              {" "}
              ({Math.abs(weeklyGrowth)}%)
            </span>
          </span>
        </button>

        <div className="admin-pipeline-command-metrics">
          <div className="admin-pipeline-kpi-mini">
            <span>Conversion Rate</span>
            <strong>{conversionRate}%</strong>
          </div>

          <div className="admin-pipeline-kpi-mini">
            <span>Activation Rate</span>
            <strong>{activationRate}</strong>
          </div>

          <div className="admin-pipeline-kpi-mini">
            <span>Active Affiliates</span>
            <strong>{counts.activated_affiliate ?? 0}</strong>
          </div>
        </div>
      </div>

      <p className="admin-pipeline-flow-helper">
        Pipeline Flow: New Applications → Under Review → Approved → Archived
      </p>

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
                const isBottleneck = card.value === bottleneckStage;
                const friction = stageFriction[card.value];

                return (
                  <button
                    key={card.label}
                    type="button"
                    className={`admin-pipeline-kpi-card ${stageClass}${
                      isActive ? " active" : ""
                    }${isBottleneck ? " bottleneck" : ""}`}
                    onClick={() => onStageSelect(card.value)}
                  >
                    {friction && (
                      <span
                        className={`admin-pipeline-bottleneck-label friction-${friction.frictionLevel}`}
                      >
                        {getFrictionLabel(friction.frictionLevel)}
                      </span>
                    )}

                    <span className="admin-pipeline-kpi-label">{card.label}</span>
                    <span className="admin-pipeline-kpi-value">{count}</span>
                    <span className="admin-pipeline-kpi-conversion">
                      {conversionRates[card.value] ?? 0}% of total
                    </span>

                    {friction && (
                      <span className="admin-pipeline-stage-duration">
                        Avg {friction.averageDaysInStage}d in stage
                      </span>
                    )}
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