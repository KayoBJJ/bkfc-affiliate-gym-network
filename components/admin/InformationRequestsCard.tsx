import { formatLabel } from "@/lib/admin/formatLabel";
import type {
  ApplicationInformationRequest,
  AttachmentReviewFormState,
} from "@/lib/admin/types";
import { InformationAttachmentReview } from "./InformationAttachmentReview";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InformationRequestsCard({
  requests,
  applicationId,
  reviewAttachmentAction,
}: {
  requests: ApplicationInformationRequest[] | null;
  applicationId: string;
  reviewAttachmentAction: (
    state: AttachmentReviewFormState,
    formData: FormData,
  ) => Promise<AttachmentReviewFormState>;
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
              {request.attachments.length ? (
                <div className="admin-information-attachments">
                  <p className="admin-pipeline-group-label">Applicant files</p>
                  {request.attachments.map((attachment) => (
                    <div key={attachment.id} className="admin-information-attachment">
                      <div className="admin-information-request-header">
                        <div>
                          <strong>{attachment.original_filename}</strong>
                          <p className="admin-timeline-date">
                            Version {attachment.version} ·{" "}
                            {(attachment.size_bytes / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        <span className={`admin-stage-pill ${attachment.status}`}>
                          {formatLabel(attachment.status)}
                        </span>
                      </div>
                      {attachment.access_url ? (
                        <a
                          href={attachment.access_url}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button admin-attachment-open"
                        >
                          Download secure file
                        </a>
                      ) : null}
                      {attachment.review_note ? (
                        <p className="admin-attachment-review-note">
                          <strong>Replacement instructions:</strong>{" "}
                          {attachment.review_note}
                        </p>
                      ) : null}
                      <InformationAttachmentReview
                        applicationId={applicationId}
                        attachment={attachment}
                        action={reviewAttachmentAction}
                      />
                    </div>
                  ))}
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
