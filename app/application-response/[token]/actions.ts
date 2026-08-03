"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { hashApplicantPortalToken } from "@/lib/application/applicant-portal";
import {
  hashInformationResponseToken,
  INFORMATION_RESPONSE_TEXT_MAX,
} from "@/lib/application/information-response";
import {
  getPortalInformationRequest,
  getPublicInformationRequest,
} from "@/lib/application/information-response-server";
import { rateLimitIdentifier } from "@/lib/application/rate-limit";
import {
  getProxyTrustConfig,
  getRateLimitConfig,
  isApplicantPortalActionsEnabled,
  isApplicantPortalEnabled,
  isInformationResponseEnabled,
} from "@/lib/config/server";

export type InformationResponseState = {
  message: string;
  status: "idle" | "success" | "error";
};

const RESPONSE_RECEIVED_MESSAGE =
  "Your information has been received securely. The BKFC team can now continue its review.";

function responseReceivedState(): InformationResponseState {
  return {
    message: RESPONSE_RECEIVED_MESSAGE,
    status: "success",
  };
}

function requestOrigin() {
  const requestHeaders = headers();
  const proxy = getProxyTrustConfig();
  if (proxy.provider === "vercel") {
    return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
  if (proxy.provider === "cloudflare") {
    return requestHeaders.get("cf-connecting-ip")?.trim() || "unknown";
  }
  return "local";
}

export async function submitInformationResponseAction(
  _previousState: InformationResponseState,
  formData: FormData
): Promise<InformationResponseState> {
  if (!isInformationResponseEnabled()) {
    return { message: "This response service is currently unavailable.", status: "error" };
  }
  const tokenValue = formData.get("token");
  const credentialKind = formData.get("credential_kind") === "portal" ? "portal" : "link";
  const requestId = formData.get("request_id");
  const responseValue = formData.get("response_text");
  if (typeof tokenValue !== "string" || typeof responseValue !== "string") {
    return { message: "The secure response link is invalid.", status: "error" };
  }
  if (
    credentialKind === "portal" &&
    (!isApplicantPortalEnabled() ||
      !isApplicantPortalActionsEnabled() ||
      typeof requestId !== "string")
  ) {
    return { message: "Portal responses are currently unavailable.", status: "error" };
  }
  const tokenHash =
    credentialKind === "portal"
      ? hashApplicantPortalToken(tokenValue)
      : hashInformationResponseToken(tokenValue);
  if (!tokenHash) {
    return { message: "The secure response link is invalid.", status: "error" };
  }

  try {
    const responseText = responseValue.trim();
    if (responseText.length > INFORMATION_RESPONSE_TEXT_MAX) {
      return {
        message: "Response cannot exceed 6,000 characters.",
        status: "error",
      };
    }
    const originHash = rateLimitIdentifier(requestOrigin(), getRateLimitConfig().secret);
    const supabase = createAdminSupabaseClient();
    const { data: allowed, error: rateLimitError } = await supabase.rpc(
      "check_affiliate_information_response_rate_limit",
      { p_token_hash: tokenHash, p_origin_hash: originHash }
    );
    if (rateLimitError || !allowed) {
      return {
        message: "Too many response attempts. Please try again later.",
        status: "error",
      };
    }
    const request =
      credentialKind === "portal"
        ? await getPortalInformationRequest(tokenValue, requestId as string)
        : await getPublicInformationRequest(tokenValue);
    if (request?.status === "responded") {
      return responseReceivedState();
    }
    if (!request || request.status !== "open") {
      return {
        message: "This response link is expired, completed, or no longer available.",
        status: "error",
      };
    }

    const { error } =
      credentialKind === "portal"
        ? await supabase.rpc("submit_affiliate_information_response_from_portal", {
            p_portal_token_hash: tokenHash,
            p_request_id: request.id,
            p_response_text: responseText,
          })
        : await supabase.rpc("submit_affiliate_information_response", {
            p_token_hash: tokenHash,
            p_response_text: responseText,
          });
    if (error) {
      if (error.code === "P0002") {
        const refreshedRequest =
          credentialKind === "portal"
            ? await getPortalInformationRequest(tokenValue, request.id)
            : await getPublicInformationRequest(tokenValue);
        if (refreshedRequest?.status === "responded") {
          return responseReceivedState();
        }
      }
      return {
        message:
          error.code === "P0002"
            ? "This response link is expired, completed, or no longer available."
            : "We could not securely save your response. Please try again.",
        status: "error",
      };
    }
    revalidatePath(`/admin/applications/${request.applicationId}`);
    return responseReceivedState();
  } catch {
    return {
      message: "The secure response service is temporarily unavailable.",
      status: "error",
    };
  }
}
