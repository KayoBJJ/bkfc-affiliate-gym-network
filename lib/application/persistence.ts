export type PersistenceError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  column?: unknown;
  column_name?: unknown;
  missing_column?: unknown;
};

export const BATCH_1A_INSERT_COLUMNS = [
  "application_reference",
  "idempotency_key",
  "payload_hash",
  "normalized_gym_name",
  "normalized_email",
  "logo_path",
  "gym_photo_paths",
  "fighter_list_path",
] as const;

export type Batch1AInsertColumn = (typeof BATCH_1A_INSERT_COLUMNS)[number];
export type LegacyFallbackTrigger = {
  triggerCode: "42703" | "PGRST204";
  missingColumn: Batch1AInsertColumn | "batch_1a_column";
};
export type PersistenceClassifierDiagnostic = {
  stage: "persistence_classifier";
  providerCode: string;
  compatibilityMode: "full_schema";
  extractedColumn: string | null;
  extractionSource: "structured" | "message_pattern" | "none";
  isAllowlistedBatch1AColumn: boolean;
  fallbackEligible: boolean;
  fallbackDenialReason:
    | "unsupported_error_code"
    | "missing_column_not_extracted"
    | "missing_column_not_allowlisted"
    | "unrelated_table"
    | "malformed_error"
    | "none";
};
export type PersistenceClassifierLogEvent = PersistenceClassifierDiagnostic & {
  durationMs: number;
};

const BATCH_1A_INSERT_COLUMN_SET = new Set<string>(BATCH_1A_INSERT_COLUMNS);
const POSTGREST_SCHEMA_CACHE_COLUMN_PATTERN =
  /^Could not find the '([a-z][a-z0-9_]*)' column of 'affiliate_applications' in the schema cache$/;
const POSTGREST_SCHEMA_CACHE_DIAGNOSTIC_PATTERN =
  /^Could not find the '([a-z][a-z0-9_]*)' column of '([a-z][a-z0-9_]*)' in the schema cache$/;
const SAFE_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diagnosticErrorCandidate(value: unknown): {
  candidate: Record<string, unknown> | null;
  isDirect: boolean;
} {
  if (!isRecord(value)) return { candidate: null, isDirect: false };

  const isApplicationError = value.name === "ApplicationError";
  if (isApplicationError) {
    const nested = isRecord(value.cause) ? value.cause : isRecord(value.error) ? value.error : null;
    return { candidate: nested ?? value, isDirect: false };
  }
  if (isRecord(value.error)) return { candidate: value.error, isDirect: false };
  return { candidate: value, isDirect: true };
}

function sanitizedProviderCode(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const sanitized = value.trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32);
  return sanitized || "unknown";
}

function safeIdentifier(value: unknown): string | null {
  return typeof value === "string" && SAFE_IDENTIFIER_PATTERN.test(value) ? value : null;
}

function diagnosticColumn(candidate: Record<string, unknown> | null): {
  column: string | null;
  source: "structured" | "message_pattern" | "none";
  table: string | null;
  malformed: boolean;
} {
  if (!candidate) return { column: null, source: "none", table: null, malformed: true };

  for (const key of ["column", "column_name", "missing_column"] as const) {
    if (typeof candidate[key] === "string") {
      const column = safeIdentifier(candidate[key]);
      return { column, source: column ? "structured" : "none", table: null, malformed: !column };
    }
  }

  let sawMessageText = false;
  let unrelatedMatch: { column: string | null; table: string | null } | null = null;
  for (const key of ["message", "details"] as const) {
    const value = candidate[key];
    if (typeof value !== "string" || value.length === 0) continue;
    sawMessageText = true;
    const match = POSTGREST_SCHEMA_CACHE_DIAGNOSTIC_PATTERN.exec(value);
    if (!match) continue;
    const parsed = {
      column: safeIdentifier(match[1]),
      table: safeIdentifier(match[2]),
    };
    if (parsed.table === "affiliate_applications") {
      return { ...parsed, source: "message_pattern", malformed: false };
    }
    unrelatedMatch ??= parsed;
  }
  if (unrelatedMatch) return { ...unrelatedMatch, source: "message_pattern", malformed: false };
  return { column: null, source: "none", table: null, malformed: sawMessageText };
}

export function buildPersistenceClassifierDiagnostic(
  error: unknown,
  evaluatedFallbackTrigger?: LegacyFallbackTrigger | null,
): PersistenceClassifierDiagnostic {
  const { candidate, isDirect } = diagnosticErrorCandidate(error);
  const rawCode = candidate?.code;
  const providerCode = sanitizedProviderCode(rawCode);
  const extraction = diagnosticColumn(candidate);
  const isAllowlistedBatch1AColumn = extraction.column !== null
    && BATCH_1A_INSERT_COLUMN_SET.has(extraction.column);
  const fallbackTrigger = evaluatedFallbackTrigger === undefined
    ? isRecord(error) ? getLegacyFallbackTrigger(error as PersistenceError) : null
    : evaluatedFallbackTrigger;
  const actualFallbackEligible = isDirect && fallbackTrigger !== null;

  let fallbackEligible = false;
  let fallbackDenialReason: PersistenceClassifierDiagnostic["fallbackDenialReason"] = "none";
  if (!isDirect) fallbackDenialReason = "malformed_error";
  else if (rawCode !== "42703" && rawCode !== "PGRST204") {
    fallbackDenialReason = "unsupported_error_code";
  } else if (actualFallbackEligible) fallbackEligible = true;
  else if (extraction.malformed) fallbackDenialReason = "malformed_error";
  else if (!extraction.column) fallbackDenialReason = "missing_column_not_extracted";
  else if (extraction.table && extraction.table !== "affiliate_applications") {
    fallbackDenialReason = "unrelated_table";
  } else if (!isAllowlistedBatch1AColumn) fallbackDenialReason = "missing_column_not_allowlisted";
  else fallbackEligible = true;

  return {
    stage: "persistence_classifier",
    providerCode,
    compatibilityMode: "full_schema",
    extractedColumn: extraction.column,
    extractionSource: extraction.source,
    isAllowlistedBatch1AColumn,
    fallbackEligible,
    fallbackDenialReason,
  };
}

function asBatch1AInsertColumn(value: unknown): Batch1AInsertColumn | null {
  return typeof value === "string" && BATCH_1A_INSERT_COLUMN_SET.has(value)
    ? value as Batch1AInsertColumn
    : null;
}

export function extractBatch1AMissingColumn(error: PersistenceError): Batch1AInsertColumn | null {
  for (const value of [error.column, error.column_name, error.missing_column]) {
    if (typeof value === "string") return asBatch1AInsertColumn(value);
  }

  for (const value of [error.message, error.details]) {
    if (typeof value !== "string") continue;
    const match = POSTGREST_SCHEMA_CACHE_COLUMN_PATTERN.exec(value);
    const column = asBatch1AInsertColumn(match?.[1]);
    if (column) return column;
  }
  return null;
}

export function getLegacyFallbackTrigger(error: PersistenceError): LegacyFallbackTrigger | null {
  if (error.code === "42703") {
    return {
      triggerCode: "42703",
      missingColumn: extractBatch1AMissingColumn(error) ?? "batch_1a_column",
    };
  }
  if (error.code !== "PGRST204") return null;

  const missingColumn = extractBatch1AMissingColumn(error);
  return missingColumn ? { triggerCode: "PGRST204", missingColumn } : null;
}

export function buildLegacyFallbackLogEvent(
  trigger: LegacyFallbackTrigger,
  durationMs: number,
) {
  return {
    stage: "persistence" as const,
    compatibilityMode: "legacy_schema" as const,
    triggerCode: trigger.triggerCode,
    missingColumn: trigger.missingColumn,
    durationMs,
  };
}

export type PersistenceValues = {
  id: string;
  applicationReference: string;
  idempotencyKey: string;
  payloadHash: string;
  normalizedGymName: string;
  normalizedEmail: string;
  gymName: string;
  cityCountry: string;
  country: string;
  region: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  disciplinesOffered: string;
  logoPath: string;
  gymPhotoPaths: string[];
  fighterListPath: string | null;
  promoVideoLink: string;
  reviewConsent: boolean;
  followUpConsent: boolean;
  bkfcAppAccessInterest: boolean;
};

export const LEGACY_INSERT_COLUMNS = [
  "id",
  "gym_name",
  "city_country",
  "country",
  "region",
  "contact_person",
  "email",
  "phone",
  "website_instagram",
  "disciplines_offered",
  "logo_url",
  "gym_photo_urls",
  "fighter_list_url",
  "promo_video_link",
  "review_consent",
  "follow_up_consent",
  "bkfc_app_access_interest",
  "status",
  "review_stage",
] as const;

export function buildFullInsertPayload(values: PersistenceValues) {
  return {
    id: values.id,
    application_reference: values.applicationReference,
    idempotency_key: values.idempotencyKey,
    payload_hash: values.payloadHash,
    normalized_gym_name: values.normalizedGymName,
    normalized_email: values.normalizedEmail,
    gym_name: values.gymName,
    city_country: values.cityCountry,
    country: values.country,
    region: values.region,
    contact_person: values.contactPerson,
    email: values.email,
    phone: values.phone,
    website_instagram: values.websiteInstagram,
    disciplines_offered: values.disciplinesOffered,
    logo_path: values.logoPath,
    gym_photo_paths: values.gymPhotoPaths,
    fighter_list_path: values.fighterListPath,
    promo_video_link: values.promoVideoLink || null,
    review_consent: values.reviewConsent,
    follow_up_consent: values.followUpConsent,
    bkfc_app_access_interest: values.bkfcAppAccessInterest,
    status: "new",
    review_stage: "submitted",
  };
}

export function buildLegacyInsertPayload(values: PersistenceValues) {
  return {
    id: values.id,
    gym_name: values.gymName,
    city_country: values.cityCountry,
    country: values.country,
    region: values.region,
    contact_person: values.contactPerson,
    email: values.email,
    phone: values.phone,
    website_instagram: values.websiteInstagram,
    disciplines_offered: values.disciplinesOffered,
    logo_url: values.logoPath,
    gym_photo_urls: values.gymPhotoPaths,
    fighter_list_url: values.fighterListPath,
    promo_video_link: values.promoVideoLink || null,
    review_consent: values.reviewConsent,
    follow_up_consent: values.followUpConsent,
    bkfc_app_access_interest: values.bkfcAppAccessInterest,
    status: "new",
    review_stage: "submitted",
  };
}

type InsertResult = {
  error: PersistenceError | null;
};

export async function insertApplicationCompatibly(
  values: PersistenceValues,
  insert: (payload: Record<string, unknown>) => Promise<InsertResult>,
  logPrimaryFailure?: (event: PersistenceClassifierLogEvent) => void,
) {
  const primaryInsertStartedAt = Date.now();
  const fullResult = await insert(buildFullInsertPayload(values));
  if (!fullResult.error) {
    return {
      error: null,
      compatibilityMode: "full_schema" as const,
      fallbackTrigger: null,
      classifierDiagnostic: null,
      storedReference: values.applicationReference,
      storedRowId: values.id,
    };
  }
  const fallbackTrigger = getLegacyFallbackTrigger(fullResult.error);
  const classifierDiagnostic = buildPersistenceClassifierDiagnostic(
    fullResult.error,
    fallbackTrigger,
  );
  logPrimaryFailure?.({
    ...classifierDiagnostic,
    durationMs: Date.now() - primaryInsertStartedAt,
  });
  if (!fallbackTrigger) {
    return {
      error: fullResult.error,
      compatibilityMode: "full_schema" as const,
      fallbackTrigger: null,
      classifierDiagnostic,
      storedReference: null,
      storedRowId: null,
    };
  }

  const legacyResult = await insert(buildLegacyInsertPayload(values));
  return {
    error: legacyResult.error,
    compatibilityMode: "legacy_schema" as const,
    fallbackTrigger,
    classifierDiagnostic,
    storedReference: legacyResult.error ? null : values.id,
    storedRowId: legacyResult.error ? null : values.id,
  };
}

export async function compensateFailedInsert<Result extends { error: PersistenceError | null }>(
  result: Result,
  cleanup: () => Promise<unknown>,
) {
  if (result.error) await cleanup();
  return result;
}
