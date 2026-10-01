import { formatLabel } from "@/lib/admin/formatLabel";
import type { ApplicationCommunicationStatus } from "@/lib/admin/types";

export function CommunicationStatusCard({
  status,
  enabled,
}: {
  status: ApplicationCommunicationStatus | null;
  enabled: boolean;
}) {
  return (
    <section className="panel admin-communication-panel">
      <div className="section-heading">
        <p className="eyebrow">Applicant Communications</p>
        <h2>{enabled ? "Master switch enabled" : "Safely disabled"}</h2>
      </div>
      {!status ? (
        <p className="admin-empty-copy">Activation migration is not applied in this environment.</p>
      ) : (
        <>
          <p className="admin-communication-summary">
            Approved copy types: {status.approvedTemplateTypes.length}. Queue items: {status.rows.length}.
          </p>
          {status.rows.length ? (
            <div className="admin-communication-list">
              {status.rows.map((row) => (
                <article className="admin-communication-row" key={row.id}>
                  <div>
                    <strong>{formatLabel(row.notification_type)}</strong>
                    <p>{new Date(row.created_at).toLocaleString("en")}</p>
                  </div>
                  <div className="admin-communication-state">
                    <strong>{formatLabel(row.delivery_status)}</strong>
                    <p>
                      {row.notification_type === "application_received" ? "Approved receipt design" : row.template ? `Copy v${row.template.version} · ${row.template.locale}` : "Copy not assigned"}
                      {` · Attempts ${row.attempt_count}/3`}
                    </p>
                    {row.last_error_code ? <p>Error: {row.last_error_code}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="admin-empty-copy">No applicant notifications are queued.</p>}
        </>
      )}
    </section>
  );
}
