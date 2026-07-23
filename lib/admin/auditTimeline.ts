import type {
  ApplicationAuditEvent,
  ApplicationStageHistoryEntry,
} from "./types.ts";

const MIRRORED_STAGE_EVENT_WINDOW_MS = 10_000;

export type ApplicationTimelineItem =
  | {
      kind: "audit";
      id: string;
      occurredAt: string;
      event: ApplicationAuditEvent;
    }
  | {
      kind: "legacy_stage";
      id: string;
      occurredAt: string;
      entry: ApplicationStageHistoryEntry;
    };

function isMirroredStageHistory(
  entry: ApplicationStageHistoryEntry,
  auditEvents: ApplicationAuditEvent[]
) {
  const historyTime = Date.parse(entry.changed_at);
  if (!Number.isFinite(historyTime)) return false;

  return auditEvents.some((event) => {
    if (
      event.event_type !== "stage_changed" ||
      event.to_review_stage !== entry.review_stage ||
      event.to_status !== entry.status
    ) {
      return false;
    }

    const auditTime = Date.parse(event.created_at);
    return (
      Number.isFinite(auditTime) &&
      Math.abs(auditTime - historyTime) <= MIRRORED_STAGE_EVENT_WINDOW_MS
    );
  });
}

export function buildApplicationTimeline(
  historyEntries: ApplicationStageHistoryEntry[],
  auditEvents: ApplicationAuditEvent[] | null
) {
  if (auditEvents === null) {
    return historyEntries
      .map<ApplicationTimelineItem>((entry) => ({
        kind: "legacy_stage",
        id: `stage:${entry.id}`,
        occurredAt: entry.changed_at,
        entry,
      }))
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  }

  const auditItems = auditEvents.map<ApplicationTimelineItem>((event) => ({
    kind: "audit",
    id: `audit:${event.id}`,
    occurredAt: event.created_at,
    event,
  }));
  const historicalItems = historyEntries
    .filter((entry) => !isMirroredStageHistory(entry, auditEvents))
    .map<ApplicationTimelineItem>((entry) => ({
      kind: "legacy_stage",
      id: `stage:${entry.id}`,
      occurredAt: entry.changed_at,
      entry,
    }));

  return [...auditItems, ...historicalItems].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  );
}
