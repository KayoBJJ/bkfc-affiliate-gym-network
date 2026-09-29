import type { AffiliateApplication, ApplicationPaymentStatus } from "./types.ts";
import { formatLabel } from "./formatLabel.ts";

type ReviewState = Pick<AffiliateApplication, "review_stage" | "status">;

// Presentation only. The existing server-side activation guards remain authoritative.
export function activationBlockedReason(application: ReviewState, payment: ApplicationPaymentStatus | null) {
  if (application.review_stage !== "approved" || application.status !== "approved") {
    return "Current review state is not approved.";
  }
  if (!payment) return "Payment coordination has not been initialized.";
  if (payment.payment_status !== "paid") return `Payment status is ${formatLabel(payment.payment_status)}.`;
  return null;
}

export function activationSummary(application: ReviewState, payment: ApplicationPaymentStatus | null, delisted = false) {
  if (delisted) return "Closed — delisted by BKFC. Earlier activation and payment events are retained as history; they do not indicate a current subscription or public listing.";
  if (application.review_stage === "activated_affiliate" && application.status === "active") {
    return "Affiliate activation completed. Subscription and public visibility are tracked separately below.";
  }
  if (application.review_stage === "rejected" && application.status === "rejected") return "Application archived. Activation is not pending.";
  const blocked = activationBlockedReason(application, payment);
  return blocked ? `Activation blocked: ${blocked}` : "Activation eligible: current approval and paid status confirmed. Public visibility requires separate BKFC confirmation.";
}
