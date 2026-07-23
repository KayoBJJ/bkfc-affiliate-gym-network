import { formatLabel } from "@/lib/admin/formatLabel";
import type { ApplicationInformationRequest } from "@/lib/admin/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InformationRequestsCard({
  requests,
}: {
  requests: ApplicationInformationRequest[] | null;
}) {
  if (requests === null) return null;
  return (
    <section className="panel admin-information-requests">
      <div className="section-heading">
        <p className="eyebrow">Applicant Follow-Up</p>
        <h2>Information requests</h2>
      </div>
      {requests.length ? (
        <div className="admin-information-request-list">
          {requests.map((request) => (
            <article key={request.id} className="admin-information-request">
              <div className="admin-information-request-header">
                <strong>{request.request_summary}</strong>
                <span className={`admin-stage-pill ${request.status}`}>
                  {formatLabel(request.status)}
                </span>
              </div>
              {request.request_details ? <p>{request.request_details}</p> : null}
              <p className="admin-timeline-date">
                Created {formatDate(request.created_at)}
                {request.created_by_email ? ` · ${request.created_by_email}` : ""}
                {" · "}Expires {formatDate(request.expires_at)}
              </p>
              {request.response_text ? (
                <div className="admin-information-response">
                  <p className="admin-pipeline-group-label">Applicant response</p>
                  <p>{request.response_text}</p>
                  {request.response_submitted_at ? (
                    <p className="admin-timeline-date">
                      Received {formatDate(request.response_submitted_at)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-copy">No structured information requests yet.</p>
      )}
    </section>
  );
}
