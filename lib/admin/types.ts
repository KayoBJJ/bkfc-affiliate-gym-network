export type AffiliateApplication = {
  id: string;
  application_reference: string | null;
  created_at: string;
  gym_name: string;
  city_country: string;
  country: string | null;
  region: string | null;
  contact_person: string;
  email: string;
  phone: string;
  website_instagram: string | null;
  disciplines_offered: string | null;
  logo_url: string | null;
  gym_photo_urls: string[] | null;
  fighter_list_url: string | null;
  logo_path: string | null;
  gym_photo_paths: string[] | null;
  fighter_list_path: string | null;
  logo_access_url?: string | null;
  gym_photo_access_urls?: string[] | null;
  fighter_list_access_url?: string | null;
  promo_video_link: string | null;
  review_consent: boolean;
  follow_up_consent: boolean;
  bkfc_app_access_interest: boolean;
  status: string;
  review_stage: string;
  internal_notes: string | null;
};

export type ReviewFormState = {
  message: string;
  status: "idle" | "success" | "error";
};

export type ApplicationStageHistoryEntry = {
  id: string;
  application_id: string;
  review_stage: string;
  status: string;
  changed_at: string;
};
