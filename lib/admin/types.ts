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

export type InformationRequestFormState = {
  message: string;
  status: "idle" | "success" | "error";
  responsePath?: string;
};

export type AttachmentReviewFormState = {
  message: string;
  status: "idle" | "success" | "error";
  responsePath?: string;
};

export type InformationLinkFormState = {
  message: string;
  status: "idle" | "success" | "error";
  responsePath?: string;
};

export type ApplicantPortalLinkFormState = {
  message: string;
  status: "idle" | "success" | "error";
  portalPath?: string;
};

export type ApplicationStageHistoryEntry = {
  id: string;
  application_id: string;
  review_stage: string;
  status: string;
  changed_at: string;
};

export type ApplicationAuditEvent = {
  id: string;
  application_id: string;
  event_type:
    | "stage_changed"
    | "internal_notes_updated"
    | "information_request_created"
    | "information_request_revoked"
    | "information_request_link_reissued"
    | "applicant_response_received"
    | "information_attachment_uploaded"
    | "information_attachment_accepted"
    | "information_attachment_replacement_requested"
    | "applicant_portal_access_issued"
    | "applicant_portal_delivery_requested"
    | "applicant_portal_delivery_sent"
    | "applicant_portal_delivery_failed"
    | "applicant_portal_recovery_requested"
    | "applicant_portal_recovery_sent"
    | "applicant_portal_access_recovered"
    | "applicant_notification_requested"
    | "applicant_notification_released"
    | "applicant_notification_sent"
    | "applicant_notification_failed";
  actor_user_id: string | null;
  actor_email: string | null;
  from_review_stage: string | null;
  to_review_stage: string | null;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type ApplicationInformationRequest = {
  id: string;
  application_id: string;
  request_summary: string;
  request_details: string | null;
  status: "open" | "responded" | "revoked" | "expired";
  expires_at: string;
  created_by_email: string | null;
  created_at: string;
  responded_at: string | null;
  revoked_at: string | null;
  response_text: string | null;
  response_submitted_at: string | null;
  attachments: ApplicationInformationAttachment[];
};

export type ApplicationInformationAttachment = {
  id: string;
  request_id: string;
  version: number;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status:
    | "uploading"
    | "uploaded"
    | "accepted"
    | "replacement_requested"
    | "rejected";
  uploaded_at: string | null;
  reviewed_at: string | null;
  reviewed_by_email: string | null;
  review_note: string | null;
  access_url: string | null;
};

export type ApplicationCommunicationStatus = {
  rows: Array<{
    id: string;
    notification_type: string;
    delivery_status: string;
    attempt_count: number;
    last_error_code: string | null;
    created_at: string;
    sent_at: string | null;
    template: null | { version: number; locale: string; approval_status: string };
  }>;
  approvedTemplateTypes: string[];
};

export type ApplicationPaymentStatus = {
  plan_code: "monthly" | "quarterly";
  payment_status: "not_requested" | "pending" | "paid" | "cancelled" | "refunded";
  payment_operation_state: string;
  current_payment_request_id: string | null;
  payment_requested_at: string | null;
  payment_link_sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  last_operational_error_code: string | null;
  delivery_status: string | null;
  command_id: string | null;
  command_type: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
};
