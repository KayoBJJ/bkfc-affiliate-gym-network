import type { AffiliateApplication } from "./types.ts";

export const FULL_APPLICATION_SELECT = `
  id,
  application_reference,
  created_at,
  gym_name,
  city_country,
  country,
  region,
  contact_person,
  email,
  phone,
  website_instagram,
  disciplines_offered,
  logo_url,
  gym_photo_urls,
  fighter_list_url,
  logo_path,
  gym_photo_paths,
  fighter_list_path,
  promo_video_link,
  review_consent,
  follow_up_consent,
  bkfc_app_access_interest,
  status,
  review_stage,
  internal_notes
`;

export const LEGACY_APPLICATION_SELECT = `
  id,
  created_at,
  gym_name,
  city_country,
  country,
  region,
  contact_person,
  email,
  phone,
  website_instagram,
  disciplines_offered,
  logo_url,
  gym_photo_urls,
  fighter_list_url,
  promo_video_link,
  review_consent,
  follow_up_consent,
  bkfc_app_access_interest,
  status,
  review_stage,
  internal_notes
`;

type QueryError = {
  code?: string;
  message: string;
};

type QueryResult<Data> = {
  data: Data | null;
  error: QueryError | null;
};

export async function queryAffiliateApplicationsCompatibly<Data>(
  execute: (selection: string) => Promise<QueryResult<Data>>,
) {
  const fullResult = await execute(FULL_APPLICATION_SELECT);
  if (!fullResult.error || fullResult.error.code !== "42703") {
    return { ...fullResult, schema: "full" as const };
  }

  const legacyResult = await execute(LEGACY_APPLICATION_SELECT);
  return { ...legacyResult, schema: "legacy" as const };
}

export function normalizeAffiliateApplication(
  row: Record<string, unknown>,
  schema: "full" | "legacy",
) {
  if (schema === "full") return row as AffiliateApplication;
  return {
    ...row,
    application_reference: null,
    logo_path: null,
    gym_photo_paths: null,
    fighter_list_path: null,
  } as AffiliateApplication;
}

export async function attachApplicationFileAccess(
  application: AffiliateApplication,
  sign: (path: string | null) => Promise<string | null>,
  legacyStoragePath: (url: string | null) => string | null,
) {
  const logoAccessUrl =
    (await sign(application.logo_path || legacyStoragePath(application.logo_url))) ||
    application.logo_url;
  const fighterListAccessUrl =
    (await sign(application.fighter_list_path || legacyStoragePath(application.fighter_list_url))) ||
    application.fighter_list_url;
  const gymPhotoAccessUrls = application.gym_photo_paths?.length
    ? (await Promise.all(application.gym_photo_paths.map(sign))).filter(
        (url): url is string => Boolean(url),
      )
    : await Promise.all(
        (application.gym_photo_urls ?? []).map(async (url) =>
          (await sign(legacyStoragePath(url))) || url,
        ),
      );

  return {
    ...application,
    logo_access_url: logoAccessUrl,
    fighter_list_access_url: fighterListAccessUrl,
    gym_photo_access_urls: gymPhotoAccessUrls,
  };
}
