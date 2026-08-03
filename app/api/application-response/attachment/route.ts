import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import {
  hashApplicantPortalToken,
  APPLICANT_PORTAL_TOKEN_PATTERN,
} from "@/lib/application/applicant-portal";
import {
  informationAttachmentStoragePath,
  validateInformationAttachmentDescriptor,
} from "@/lib/application/information-attachment";
import {
  hashInformationResponseToken,
  INFORMATION_RESPONSE_TOKEN_PATTERN,
} from "@/lib/application/information-response";
import {
  getPortalInformationRequest,
  getPublicInformationRequest,
} from "@/lib/application/information-response-server";
import { STORAGE_BUCKET } from "@/lib/application/policy";
import { rateLimitIdentifier } from "@/lib/application/rate-limit";
import { validateFile } from "@/lib/application/validation";
import {
  getProxyTrustConfig,
  getRateLimitConfig,
  isApplicantPortalActionsEnabled,
  isApplicantPortalEnabled,
  isInformationResponseEnabled,
} from "@/lib/config/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
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

async function checkRateLimit(tokenHash: string) {
  const originHash = rateLimitIdentifier(requestOrigin(), getRateLimitConfig().secret);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc(
    "check_affiliate_information_response_rate_limit",
    { p_token_hash: tokenHash, p_origin_hash: originHash },
  );
  return !error && Boolean(data);
}

export async function POST(request: Request) {
  if (!isInformationResponseEnabled()) {
    return jsonError("Secure file responses are currently unavailable.", 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Invalid secure upload request.", 400);
  }

  const credentialKind = body.credentialKind === "portal" ? "portal" : "link";
  const token =
    credentialKind === "portal"
      ? typeof body.portalToken === "string"
        ? body.portalToken
        : ""
      : typeof body.token === "string"
        ? body.token
        : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (
    credentialKind === "portal" &&
    (!isApplicantPortalEnabled() || !isApplicantPortalActionsEnabled())
  ) {
    return jsonError("Portal responses are currently unavailable.", 404);
  }
  const tokenPattern =
    credentialKind === "portal"
      ? APPLICANT_PORTAL_TOKEN_PATTERN
      : INFORMATION_RESPONSE_TOKEN_PATTERN;
  if (!tokenPattern.test(token)) {
    return jsonError("This secure response link is invalid.", 400);
  }
  const tokenHash =
    credentialKind === "portal"
      ? hashApplicantPortalToken(token)
      : hashInformationResponseToken(token);
  if (!tokenHash || !(await checkRateLimit(tokenHash))) {
    return jsonError("Too many upload attempts. Please try again later.", 429);
  }
  const informationRequest =
    credentialKind === "portal"
      ? await getPortalInformationRequest(token, requestId)
      : await getPublicInformationRequest(token);
  if (!informationRequest || informationRequest.status !== "open") {
    return jsonError("This response link is expired or no longer available.", 410);
  }

  const supabase = createAdminSupabaseClient();
  if (body.action === "abort") {
    const attachmentId =
      typeof body.attachmentId === "string" ? body.attachmentId : "";
    const { data: attachment } = await supabase
      .from("affiliate_application_information_attachments")
      .select("id, storage_path, status")
      .eq("id", attachmentId)
      .eq("request_id", informationRequest.id)
      .maybeSingle();
    if (attachment?.status === "uploading") {
      await supabase.storage.from(STORAGE_BUCKET).remove([attachment.storage_path]);
      await supabase
        .from("affiliate_application_information_attachments")
        .update({
          status: "rejected",
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", attachment.id)
        .eq("status", "uploading");
    }
    return NextResponse.json({ success: true });
  }

  if (body.action === "create") {
    try {
      const descriptor = validateInformationAttachmentDescriptor(body.file);
      const attachmentId = randomUUID();
      const storagePath = informationAttachmentStoragePath(
        informationRequest.applicationId,
        informationRequest.id,
        descriptor.extension,
      );
      const uploadParameters = {
        p_attachment_id: attachmentId,
        p_storage_path: storagePath,
        p_original_filename: descriptor.name,
        p_content_type: descriptor.contentType,
        p_size_bytes: descriptor.size,
      };
      const { data: version, error: createError } =
        credentialKind === "portal"
          ? await supabase.rpc(
              "create_affiliate_information_attachment_upload_from_portal",
              {
                ...uploadParameters,
                p_portal_token_hash: tokenHash,
                p_request_id: informationRequest.id,
              },
            )
          : await supabase.rpc("create_affiliate_information_attachment_upload", {
              ...uploadParameters,
              p_token_hash: tokenHash,
            });
      if (createError) {
        return jsonError(
          createError.code === "23505"
            ? "A file is already waiting to be submitted."
            : "Unable to prepare the secure upload.",
          createError.code === "23505" ? 409 : 400,
        );
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (signedError || !signed?.token) {
        await supabase
          .from("affiliate_application_information_attachments")
          .delete()
          .eq("id", attachmentId)
          .eq("status", "uploading");
        return jsonError("Unable to prepare the secure upload.", 503);
      }
      return NextResponse.json({
        success: true,
        attachmentId,
        path: storagePath,
        uploadToken: signed.token,
        contentType: descriptor.contentType,
        version,
      });
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Select a valid file.",
        400,
      );
    }
  }

  if (body.action === "finalize") {
    const attachmentId =
      typeof body.attachmentId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.attachmentId,
      )
        ? body.attachmentId
        : "";
    if (!attachmentId) return jsonError("Invalid secure upload request.", 400);

    const { data: attachment, error: attachmentError } = await supabase
      .from("affiliate_application_information_attachments")
      .select(
        "id, request_id, storage_path, original_filename, content_type, size_bytes, status",
      )
      .eq("id", attachmentId)
      .eq("request_id", informationRequest.id)
      .maybeSingle();
    if (attachmentError || !attachment) {
      return jsonError("The uploaded file is unavailable.", 404);
    }
    if (attachment.status === "uploaded") {
      return NextResponse.json({ success: true, attachmentId });
    }
    if (attachment.status !== "uploading") {
      return jsonError("The uploaded file is no longer available.", 409);
    }

    const { data: storedFile, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(attachment.storage_path);
    try {
      if (
        downloadError ||
        !storedFile ||
        storedFile.size !== Number(attachment.size_bytes)
      ) {
        throw new Error("upload_incomplete");
      }
      await validateFile(
        new File([storedFile], attachment.original_filename, {
          type: attachment.content_type,
        }),
        "informationResponseAttachment",
      );
    } catch {
      await supabase.storage.from(STORAGE_BUCKET).remove([attachment.storage_path]);
      await supabase
        .from("affiliate_application_information_attachments")
        .update({
          status: "rejected",
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", attachment.id)
        .eq("status", "uploading");
      return jsonError(
        "The file could not be verified. Please select a supported file and try again.",
        400,
      );
    }

    const { error: finalizeError } =
      credentialKind === "portal"
        ? await supabase.rpc("finalize_affiliate_information_attachment_from_portal", {
            p_portal_token_hash: tokenHash,
            p_request_id: informationRequest.id,
            p_attachment_id: attachment.id,
          })
        : await supabase.rpc("finalize_affiliate_information_attachment", {
            p_token_hash: tokenHash,
            p_attachment_id: attachment.id,
          });
    if (finalizeError) {
      return jsonError("Unable to finish the secure upload.", 503);
    }
    return NextResponse.json({ success: true, attachmentId });
  }

  return jsonError("Invalid secure upload request.", 400);
}
