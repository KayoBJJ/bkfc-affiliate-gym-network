export type PersistenceError = {
  code?: string;
  message?: string;
};

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
) {
  const fullResult = await insert(buildFullInsertPayload(values));
  if (!fullResult.error) {
    return {
      error: null,
      compatibilityMode: "full_schema" as const,
      storedReference: values.applicationReference,
      storedRowId: values.id,
    };
  }
  if (fullResult.error.code !== "42703") {
    return {
      error: fullResult.error,
      compatibilityMode: "full_schema" as const,
      storedReference: null,
      storedRowId: null,
    };
  }

  const legacyResult = await insert(buildLegacyInsertPayload(values));
  return {
    error: legacyResult.error,
    compatibilityMode: "legacy_schema" as const,
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
