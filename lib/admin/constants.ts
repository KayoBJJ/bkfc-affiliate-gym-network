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
  { value: "submitted", label: "New Submission" },
  { value: "under_review", label: "Internal Review" },
  { value: "follow_up_required", label: "Needs Follow-Up" },
  { value: "interview", label: "Interview Scheduled" },
  { value: "trial_candidate", label: "Trial Candidate Pool" },
  { value: "approved", label: "Approved Pending Activation" },
  { value: "activated_affiliate", label: "Active Affiliate" },
  { value: "rejected", label: "Rejected / Archived" },
] as const;
