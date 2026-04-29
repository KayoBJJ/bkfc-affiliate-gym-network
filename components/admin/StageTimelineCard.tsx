import type { ApplicationStageHistoryEntry } from "@/lib/admin/types";

type StageTimelineCardProps = {
  historyEntries: ApplicationStageHistoryEntry[];
};

function formatStageLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function StageTimelineCard({ historyEntries }: StageTimelineCardProps) {
  return (
    <section className="panel admin-timeline-panel">
      <div className="section-heading">
        <p className="eyebrow">Stage Timeline</p>
        <h2>Review progression</h2>
      </div>

      {historyEntries.length > 0 ? (
        <div className="admin-timeline-list">
          {historyEntries.map((entry) => (
            <article key={entry.id} className="admin-timeline-item">
              <div className="admin-timeline-dot" aria-hidden="true" />
              <div>
                <p className="admin-timeline-stage">{formatStageLabel(entry.review_stage)}</p>
                <p className="admin-timeline-date">{formatTimelineDate(entry.changed_at)}</p>
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
