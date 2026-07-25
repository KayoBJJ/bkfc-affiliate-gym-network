import { createHash, randomBytes } from "node:crypto";

export const APPLICANT_PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const APPLICANT_PORTAL_VALID_DAYS = 180;

export type ApplicantProgressStage =
  | "submitted"
  | "under_review"
  | "follow_up_required"
  | "interview"
  | "trial_candidate"
  | "approved"
  | "rejected"
  | "activated_affiliate";

export type ApplicantProgressSummary = {
  label: string;
  headline: string;
  description: string;
  progress: number;
  activeMilestone: number;
  tone: "neutral" | "review" | "action" | "positive" | "complete";
};

export const APPLICANT_PROGRESS_MILESTONES = [
  {
    label: "Application received",
    description: "Your application is securely on file.",
  },
  {
    label: "BKFC review",
    description: "The team is assessing your gym and submitted information.",
  },
  {
    label: "Next-step review",
    description: "BKFC may request information or discuss the next stage.",
  },
  {
    label: "Decision",
    description: "The application outcome is confirmed.",
  },
  {
    label: "Affiliate activation",
    description: "Approved gyms complete their activation steps.",
  },
] as const;

const PROGRESS_BY_STAGE: Record<ApplicantProgressStage, ApplicantProgressSummary> = {
  submitted: {
    label: "Application received",
    headline: "Your application is in the queue",
    description:
      "BKFC has received your application. The team will begin its initial review.",
    progress: 15,
    activeMilestone: 0,
    tone: "neutral",
  },
  under_review: {
    label: "Review in progress",
    headline: "Your gym is under review",
    description:
      "The BKFC team is reviewing your application. No action is required right now.",
    progress: 35,
    activeMilestone: 1,
    tone: "review",
  },
  follow_up_required: {
    label: "Action required",
    headline: "BKFC needs information from you",
    description:
      "Review the open request below and respond using the secure link supplied by BKFC.",
    progress: 50,
    activeMilestone: 2,
    tone: "action",
  },
  interview: {
    label: "Next-step review",
    headline: "Your application has advanced",
    description:
      "BKFC is considering your gym for the next stage. The team will contact you when an action is required.",
    progress: 60,
    activeMilestone: 2,
    tone: "review",
  },
  trial_candidate: {
    label: "Candidate review",
    headline: "Your gym is in the candidate pool",
    description:
      "Your application remains active while BKFC evaluates the next affiliation opportunity.",
    progress: 72,
    activeMilestone: 2,
    tone: "review",
  },
  approved: {
    label: "Approved",
    headline: "Your application is approved",
    description:
      "BKFC has approved your gym application. The team will guide you through activation.",
    progress: 88,
    activeMilestone: 3,
    tone: "positive",
  },
  rejected: {
    label: "Decision complete",
    headline: "Your application review is complete",
    description:
      "BKFC has completed its review. Please refer to the direct communication from the team for the decision details.",
    progress: 100,
    activeMilestone: 3,
    tone: "complete",
  },
  activated_affiliate: {
    label: "Active affiliate",
    headline: "Welcome to the BKFC Gym Network",
    description:
      "Your gym is active in the BKFC Affiliate Gym Network.",
    progress: 100,
    activeMilestone: 4,
    tone: "positive",
  },
};

export function generateApplicantPortalToken() {
  return randomBytes(32).toString("base64url");
}

export function hashApplicantPortalToken(token: string) {
  if (!APPLICANT_PORTAL_TOKEN_PATTERN.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

export function getApplicantProgressSummary(stage: string): ApplicantProgressSummary {
  return PROGRESS_BY_STAGE[stage as ApplicantProgressStage] ?? PROGRESS_BY_STAGE.submitted;
}

