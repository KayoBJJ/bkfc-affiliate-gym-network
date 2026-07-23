import { formatLabel, getStageClass } from "@/lib/admin/formatLabel";
import { buildApplicationTimeline } from "@/lib/admin/auditTimeline";
import type {
  ApplicationAuditEvent,
  ApplicationStageHistoryEntry,
} from "@/lib/admin/types";

type StageTimelineCardProps = {
  historyEntries: ApplicationStageHistoryEntry[];
  auditEvents: ApplicationAuditEvent[] | null;
};

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function auditEventLabel(event: ApplicationAuditEvent) {
  if (event.event_type === "stage_changed") {
    return `Moved from ${formatLabel(event.from_review_stage ?? "unknown")} to ${formatLabel(
      event.to_review_stage ?? "unknown"
    )}`;
  }
  if (event.event_type === "internal_notes_updated") {
    return "Internal notes updated";
  }
  if (event.event_type === "applicant_notification_requested") {
    return "Applicant notification prepared — awaiting approved copy";
  }
  if (event.event_type === "applicant_notification_sent") {
    return "Applicant notification sent";
  }
  return "Applicant notification delivery failed";
}

export function StageTimelineCard({
  historyEntries,
  auditEvents,
}: StageTimelineCardProps) {
  const hasAuditTrail = auditEvents !== null;
  const timelineItems = buildApplicationTimeline(historyEntries, auditEvents);

  return (
    <section className="panel admin-timeline-panel">
      <div className="section-heading">
        <p className="eyebrow">{hasAuditTrail ? "Audit Trail" : "Stage Timeline"}</p>
        <h2>{hasAuditTrail ? "Recorded admin activity" : "Review progression"}</h2>
      </div>

      {timelineItems.length > 0 ? (
        <div className="admin-timeline-list">
          {timelineItems.map((item, index) => (
            <article
              key={item.id}
              className={`admin-timeline-item${index === 0 ? " latest" : ""}`}
            >
              <div className="admin-timeline-dot" aria-hidden="true" />
              <div>
                {item.kind === "audit" ? (
                  <>
                    <p>{auditEventLabel(item.event)}</p>
                    <p className="admin-timeline-date">
                      {formatTimelineDate(item.occurredAt)}
                      {item.event.actor_email ? ` · ${item.event.actor_email}` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span
                        className={`admin-stage-pill admin-timeline-stage-pill ${getStageClass(
                          item.entry.review_stage
                        )}`}
                      >
                        {formatLabel(item.entry.review_stage)}
                      </span>
                    </p>
                    <p className="admin-timeline-date">
                      {formatTimelineDate(item.occurredAt)}
                    </p>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-copy">No stage changes have been recorded yet.</p>
      )}
    </section>
  );
}
