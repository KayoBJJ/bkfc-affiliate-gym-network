import "server-only";
import type { PersistenceClassifierLogEvent } from "./persistence";

type LogLevel = "info" | "warn" | "error";
type RegularApplicationLogEvent = {
  applicationReference?: string;
  stage: string;
  code: string;
  field?: string;
  fileCategory?: string;
  compatibilityMode?: "full_schema" | "legacy_schema";
  cleanup?: "not_required" | "succeeded" | "failed";
  notification?: "sent" | "skipped" | "failed";
  notificationType?: "internal" | "applicant_template" | "applicant_portal";
  durationMs?: number;
  pipelineStage?:
    | "idempotency_lookup"
    | "rate_limit"
    | "duplicate_lookup"
    | "storage_upload"
    | "database_insert";
  providerCode?: string;
};

type CompatibilityFallbackLogEvent = {
  stage: "persistence";
  compatibilityMode: "legacy_schema";
  triggerCode: "42703" | "PGRST204";
  missingColumn: string;
  durationMs: number;
};

export function logApplicationEvent(
  level: LogLevel,
  event: RegularApplicationLogEvent | CompatibilityFallbackLogEvent | PersistenceClassifierLogEvent,
) {
  const entry = JSON.stringify({ event: "affiliate_application", ...event });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
