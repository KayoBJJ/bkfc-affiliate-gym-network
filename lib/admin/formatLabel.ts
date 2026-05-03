const stageLabelMap: Record<string, string> = {
  submitted: "New Submission",
  under_review: "Internal Review",
  follow_up_required: "Needs Follow-Up",
  interview: "Interview Scheduled",
  trial_candidate: "Trial Candidate Pool",
  approved: "Approved Pending Activaton",
  activated_affiliate: "Active Affiliate",
  rejected: "Rejected / Archived",
};

const stageClassMap: Record<string, string> = {
  submitted: "stage-submitted",
  under_review: "stage-under-review",
  follow_up_required: "stage-follow-up",
  interview: "stage-interview",
  trial_candidate: "stage-trial",
  approved: "stage-approved",
  activated_affiliate: "stage-active",
  rejected: "stage-rejected",
};

export function formatLabel(value: string) {
  if (stageLabelMap[value]) {
    return stageLabelMap[value];
  }

  const normalized = value.replace(/_/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const titleCased = normalized.replace(/\b\w/g, (character) => character.toUpperCase());

  return titleCased.replace(/Follow Up/g, "Follow-up");
}

export function getStageClass(stage: string) {
  return stageClassMap[stage] ?? "stage-default";
}
