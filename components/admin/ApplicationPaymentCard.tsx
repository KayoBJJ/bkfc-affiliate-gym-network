import { formatLabel } from "@/lib/admin/formatLabel";
import type { AffiliateApplication, ApplicationPaymentStatus } from "@/lib/admin/types";

import { activationSummary } from "@/lib/admin/activation-presentation";
export { activationBlockedReason } from "@/lib/admin/activation-presentation";

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : "—";
}

export function ApplicationPaymentCard({
  application,
  payment,
  delisted = false,
}: {
  application: AffiliateApplication;
  payment: ApplicationPaymentStatus | null;
  delisted?: boolean;
}) {
  const summary = activationSummary(application, payment, delisted);
  return (
    <section className="panel admin-detail-panel">
      <div className="section-heading">
        <p className="eyebrow">BKFC Payment Coordination</p>
        <h2>{delisted ? "Payment and delivery history" : "Payment and delivery state"}</h2>
      </div>
      {!payment ? <p className="admin-empty-copy">Payment coordination is unavailable.</p> : (
        <div className="admin-detail-grid">
          <div><p className="admin-detail-label">Plan</p><p>{formatLabel(payment.plan_code)}</p></div>
          <div><p className="admin-detail-label">{delisted ? "Recorded payment status" : "Payment status"}</p><p>{formatLabel(payment.payment_status)}</p></div>
          <div><p className="admin-detail-label">Payment operation</p><p>{formatLabel(payment.payment_operation_state)}</p></div>
          <div><p className="admin-detail-label">Command delivery</p><p>{payment.delivery_status ? formatLabel(payment.delivery_status) : "—"}</p></div>
          <div><p className="admin-detail-label">Latest command</p><p>{payment.command_type ? `${formatLabel(payment.command_type)} · ${payment.command_id}` : "—"}</p></div>
          <div><p className="admin-detail-label">Current payment request</p><p>{payment.current_payment_request_id ?? "—"}</p></div>
          <div><p className="admin-detail-label">Attempts / next attempt</p><p>{payment.attempt_count ?? "—"} / {timestamp(payment.next_attempt_at)}</p></div>
          <div><p className="admin-detail-label">Requested</p><p>{timestamp(payment.payment_requested_at)}</p></div>
          <div><p className="admin-detail-label">Link sent</p><p>{timestamp(payment.payment_link_sent_at)}</p></div>
          <div><p className="admin-detail-label">Subscription at last callback</p><p>{formatLabel(payment.subscription_status)}</p></div>
          <div><p className="admin-detail-label">Last renewal paid</p><p>{timestamp(payment.last_renewal_paid_at)}</p></div>
          <div><p className="admin-detail-label">Last overdue event</p><p>{timestamp(payment.past_due_at)}</p></div>
          <div><p className="admin-detail-label">Subscription ended</p><p>{timestamp(payment.subscription_cancelled_at)}</p></div>
          <div><p className="admin-detail-label">Initial payment</p><p>{timestamp(payment.paid_at)}</p></div>
          <div><p className="admin-detail-label">Cancelled</p><p>{timestamp(payment.cancelled_at)}</p></div>
          <div><p className="admin-detail-label">Refunded</p><p>{timestamp(payment.refunded_at)}</p></div>
          <div><p className="admin-detail-label">Delivery / intervention condition</p><p>{payment.last_operational_error_code ?? "None"}</p></div>
        </div>
      )}
      <p className="admin-detail-value">{summary}</p>
    </section>
  );
}
