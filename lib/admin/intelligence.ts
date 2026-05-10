import { getStageClass } from "@/lib/admin/formatLabel";
import type { AffiliateApplication,} from "@/lib/admin/types";

export type FrictionLevel = "low" | "medium" | "high";
export type MilestoneStatus = "new" | "in_review" | "qualified" | "stalled" | "converted";

export type ApplicationIntelligence = {
  id: string;
  region: string;
  country: string;
  stage: string;
  stageLabel: string;
  stageClassName: string;
  frictionLevel: FrictionLevel;
  milestoneStatus: MilestoneStatus;
  nextAction: string;
  daysInStage: number;
  frictionLabel: string;
  frictionClassName: string;
};

export function getApplicationIntelligence(
  application: AffiliateApplication
): ApplicationIntelligence {
  const stage = application.review_stage || "new";
  const friction = getApplicationFriction(application)

  return {
    id: application.id,
    region: application.region || "Unassigned",
    country: application.country || "Unassigned",
    stage,
    stageLabel: getStageLabel(stage),
    stageClassName: getStageClass(stage),
    frictionLevel: getFrictionLevel(application),
    milestoneStatus: getMilestoneStatus(stage),
    nextAction: getNextAction(stage),

    daysInStage: getDaysInStage(application.created_at),
    frictionLabel: friction.label,
    frictionClassName: friction.className,
  };
}

function getStageLabel(stage: string): string {
  switch (stage) {
    case "submitted":
      return "Submitted";

    case "under_review":
      return "Under Review";

    case "follow_up_required":
      return "Follow-up Required";

    case "interview":
      return "Interview";

    case "trial_candidate":
      return "Trial Candidate";

    case "approved":
      return "Approved";

    case "activated_affiliate":
      return "Activated Affiliate";

    case "rejected":
      return "Rejected";

    default:
      return "Unknown";
  }
}

function getFrictionLevel(
  application: AffiliateApplication
): FrictionLevel {
  const stage = application.review_stage;

  if (stage === "stalled") {
    return "high";
  }

  if (stage === "review") {
    return "medium";
  }

  return "low";
}

function getMilestoneStatus(stage: string): MilestoneStatus {
  switch (stage) {
    case "submitted":
      return "new";

    case "under_review":
    case "follow_up_required":
    case "interview":
      return "in_review";

    case "trial_candidate":
    case "approved":
      return "qualified";

    case "activated_affiliate":
      return "converted";

    case "rejected":
      return "stalled";

    default:
      return "new";
  }
}

function getNextAction(stage: string): string {
  switch (stage) {
    case "submitted":
      return "Initial review required";

    case "under_review":
      return "Continue evaluation";

    case "follow_up_required":
      return "Follow up with applicant";

    case "interview":
      return "Schedule interview";

    case "trial_candidate":
      return "Prepare trial process";

    case "approved":
      return "Finalize onboarding";

    case "activated_affiliate":
      return "Monitor activation";

    case "rejected":
      return "Archive application";

    default:
      return "Awaiting update";
  }
}

const stageThresholds: Record<string, number> = {
  submitted: 3,
  under_review: 7,
  follow_up_required: 5,
  interview: 7,
  trial_candidate: 14,
  approved: 14,
  activated_affiliate: 30,
  rejected: 30,
};

function getDaysInStage(createdAt: string): number {
  const now = new Date();
  const createdDate = new Date(createdAt);

  return Math.max(
    0,
    Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function getApplicationFriction(application: AffiliateApplication): {
  label: string;
  className: string;
} {
  const stage = application.review_stage || "new";
  const threshold = stageThresholds[stage] ?? 7;
  const daysInStage = getDaysInStage(application.created_at);

  if (daysInStage >= threshold) {
    return {
      label: `Stuck ${daysInStage}d`,
      className: "friction-stuck",
    };
  }

  if (daysInStage >= threshold * 0.7) {
    return {
      label: `Slowing ${daysInStage}d`,
      className: "friction-slowing",
    };
  }

  return {
    label: `Healthy ${daysInStage}d`,
    className: "friction-healthy",
  };
}