import "server-only";

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
  notificationType?: "internal" | "applicant_template";
  durationMs?: number;
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
  event: RegularApplicationLogEvent | CompatibilityFallbackLogEvent,
) {
  const entry = JSON.stringify({ event: "affiliate_application", ...event });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
