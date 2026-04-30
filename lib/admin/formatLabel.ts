const stageLabelMap: Record<string, string> = {
  submitted: "SUBMITTED",
  under_review: "IN REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  activated_affiliate: "ACTIVE",
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
