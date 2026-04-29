export const REVIEW_STAGE_OPTIONS = [
  "submitted",
  "under_review",
  "follow_up_required",
  "interview",
  "trial_candidate",
  "approved",
  "rejected",
  "activated_affiliate",
];

export const APPLICATION_STATUS_OPTIONS = [
  "new",
  "in_review",
  "pending_info",
  "candidate",
  "approved",
  "rejected",
  "active",
];

export const KPI_REGIONS = ["Europe", "MENA", "LATAM", "North America"] as const;

export const REVIEW_STAGE_FILTER_TABS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "follow_up_required", label: "Follow-Up" },
  { value: "interview", label: "Interview" },
  { value: "trial_candidate", label: "Trial Candidate" },
  { value: "approved", label: "Approved" },
  { value: "activated_affiliate", label: "Activated" },
  { value: "rejected", label: "Rejected" },
] as const;
