import { BKFC_APPLICATION_ID_PATTERN } from "./contracts.ts";

export type ReviewPair = { reviewStage: string; status: string };
export type PaymentDecision = "none" | "no_op" | "initiate" | "suppress" | "cancel" | "deny_activation";

export function hasExplicitBkfcIdentity(sourceSystem: string | null, sourceApplicationId: string | null) {
  return sourceSystem === "bkfc" && sourceApplicationId !== null && BKFC_APPLICATION_ID_PATTERN.test(sourceApplicationId);
}

export function paymentDecisionForReviewTransition(input: {
  sourceSystem: string | null;
  sourceApplicationId: string | null;
  current: ReviewPair;
  target: ReviewPair;
  paymentStatus?: "not_requested" | "pending" | "paid" | "cancelled" | "refunded";
  initiationDeliveryStatus?: "queued" | "retry_wait" | "sending" | "accepted" | "intervention_required" | "suppressed";
  initiationClaimed?: boolean;
}): PaymentDecision {
  if (input.current.reviewStage === input.target.reviewStage && input.current.status === input.target.status) return "no_op";
  if (!hasExplicitBkfcIdentity(input.sourceSystem, input.sourceApplicationId)) return "none";
  if (input.target.reviewStage === "activated_affiliate" && input.target.status === "active") {
    return input.current.reviewStage === "approved" && input.current.status === "approved" && input.paymentStatus === "paid"
      ? "none" : "deny_activation";
  }
  if (input.target.reviewStage === "approved" && input.target.status === "approved") {
    return input.paymentStatus === "not_requested" || input.paymentStatus === "cancelled" ? "initiate" : "none";
  }
  if (input.current.reviewStage === "approved" && input.current.status === "approved") {
    return (input.initiationDeliveryStatus === "queued" || input.initiationDeliveryStatus === "retry_wait") && !input.initiationClaimed
      ? "suppress" : "cancel";
  }
  return "none";
}
