import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicationTimeline } from "../lib/admin/auditTimeline.ts";
import type {
  ApplicationAuditEvent,
  ApplicationStageHistoryEntry,
} from "../lib/admin/types.ts";

function history(
  id: string,
  reviewStage: string,
  status: string,
  changedAt: string
): ApplicationStageHistoryEntry {
  return {
    id,
    application_id: "d58a32fb-c475-4996-aba0-5a198dca559f",
    review_stage: reviewStage,
    status,
    changed_at: changedAt,
  };
}

function audit(
  id: string,
  eventType: ApplicationAuditEvent["event_type"],
  createdAt: string,
  values: Partial<ApplicationAuditEvent> = {}
): ApplicationAuditEvent {
  return {
    id,
    application_id: "d58a32fb-c475-4996-aba0-5a198dca559f",
    event_type: eventType,
    actor_user_id: null,
    actor_email: "admin@example.com",
    from_review_stage: null,
    to_review_stage: null,
    from_status: null,
    to_status: null,
    details: {},
    created_at: createdAt,
    ...values,
  };
}

test("pre-migration stage history remains visible after a new audit event", () => {
  const timeline = buildApplicationTimeline(
    [history("old-stage", "under_review", "in_review", "2026-07-22T13:50:00.000Z")],
    [audit("notes", "internal_notes_updated", "2026-07-23T13:06:00.000Z")]
  );

  assert.deepEqual(
    timeline.map((item) => [item.kind, item.id]),
    [
      ["audit", "audit:notes"],
      ["legacy_stage", "stage:old-stage"],
    ]
  );
});

test("a stage-history row written by the same atomic transition is shown only once", () => {
  const timeline = buildApplicationTimeline(
    [
      history(
        "mirrored-stage",
        "interview",
        "in_review",
        "2026-07-23T13:10:00.000Z"
      ),
    ],
    [
      audit("transition", "stage_changed", "2026-07-23T13:10:00.020Z", {
        from_review_stage: "under_review",
        to_review_stage: "interview",
        from_status: "in_review",
        to_status: "in_review",
      }),
    ]
  );

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].id, "audit:transition");
});

test("similar stage entries outside the transition window are retained", () => {
  const timeline = buildApplicationTimeline(
    [
      history(
        "earlier-stage",
        "interview",
        "in_review",
        "2026-07-22T13:10:00.000Z"
      ),
    ],
    [
      audit("transition", "stage_changed", "2026-07-23T13:10:00.020Z", {
        to_review_stage: "interview",
        to_status: "in_review",
      }),
    ]
  );

  assert.equal(timeline.length, 2);
});

test("legacy fallback works before the audit migration is available", () => {
  const timeline = buildApplicationTimeline(
    [
      history("older", "submitted", "new", "2026-07-20T10:00:00.000Z"),
      history("newer", "under_review", "in_review", "2026-07-21T10:00:00.000Z"),
    ],
    null
  );

  assert.deepEqual(
    timeline.map((item) => item.id),
    ["stage:newer", "stage:older"]
  );
});
