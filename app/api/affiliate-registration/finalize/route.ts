import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getPrivilegedSupabaseConfig } from "@/lib/config/server";
import { clientErrorPayload } from "@/lib/application/diagnostics";
import { formDataFromPayload } from "@/lib/application/direct-upload";
import type { IssuedUpload } from "@/lib/application/direct-upload-contract";
import { sendApplicationNotifications } from "@/lib/application/email";
import { logApplicationEvent } from "@/lib/application/logging";
import { insertApplicationCompatibly } from "@/lib/application/persistence";
import { ApplicationError, STORAGE_BUCKET, type ApiCode } from "@/lib/application/policy";
import { runNonCriticalNotification } from "@/lib/application/staged";
import { validateApplicationForm } from "@/lib/application/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

function error(code: ApiCode, status: number, field?: string) {
  return NextResponse.json(clientErrorPayload(code, field), { status });
}

function success(applicationReference: string, reused = false) {
  return NextResponse.json({
    success: true,
    code: reused ? "APPLICATION_ALREADY_RECEIVED" : "APPLICATION_RECEIVED",
    applicationReference,
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") ?? "").match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
}

function extractCountry(cityCountry: string) {
  const parts = cityCountry.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || cityCountry;
}

function getRegionFromCountry(country: string) {
  const value = country.toLocaleLowerCase("en-US");
  const regions: Record<string, string[]> = {
    Europe: ["bulgaria", "spain", "italy", "serbia", "poland", "germany", "france", "netherlands", "belgium", "romania", "greece", "hungary", "croatia", "montenegro", "albania", "north macedonia", "austria", "switzerland", "united kingdom", "ireland", "portugal"],
    MENA: ["uae", "united arab emirates", "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "egypt", "morocco", "tunisia", "jordan", "lebanon"],
    LATAM: ["mexico", "brazil", "argentina", "colombia", "chile", "peru", "uruguay", "paraguay", "ecuador", "venezuela"],
    "North America": ["usa", "united states", "united states of america", "canada"],
  };
  return Object.entries(regions).find(([, countries]) => countries.includes(value))?.[0] ?? "Other";
}

async function downloadIssuedFiles(
  supabase: ReturnType<typeof createClient<any>>,
  formData: FormData,
  manifest: IssuedUpload[],
) {
  for (const item of manifest) {
    const { data, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(item.path);
    if (downloadError || !data || data.size !== item.size) {
      throw new Error("upload_incomplete");
    }
    formData.append(item.field === "gymPhotos" ? "gymPhotos" : item.field,
      new File([data], item.name, { type: item.contentType }));
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const config = getPrivilegedSupabaseConfig();
  const supabase = createClient<any>(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let sessionId: string | undefined;
  let manifest: IssuedUpload[] = [];
  try {
    const token = bearerToken(request);
    if (!token) return error("VALIDATION_FAILED", 401);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return error("VALIDATION_FAILED", 401);
    const body = await request.json() as { sessionId?: unknown };
    if (typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
      return error("VALIDATION_FAILED", 400);
    }
    sessionId = body.sessionId;

    const { data: session, error: sessionError } = await supabase
      .from("affiliate_application_upload_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("uploader_id", authData.user.id)
      .maybeSingle();
    if (sessionError || !session) return error("VALIDATION_FAILED", 404);
    if (session.status === "finalized") return success(session.application_reference, true);
    if (session.status !== "pending" || new Date(session.expires_at).getTime() <= Date.now()) {
      return error("VALIDATION_FAILED", 409);
    }
    manifest = session.upload_manifest as IssuedUpload[];

    const { data: claimed, error: claimError } = await supabase
      .from("affiliate_application_upload_sessions")
      .update({ status: "finalizing", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) return error("PERSISTENCE_UNAVAILABLE", 409);

    const formData = formDataFromPayload(session.form_payload);
    await downloadIssuedFiles(supabase, formData, manifest);
    const application = await validateApplicationForm(formData);
    const country = extractCountry(application.cityCountry);
    const logoPath = manifest.find((item) => item.field === "logoUpload")!.path;
    const gymPhotoPaths = manifest.filter((item) => item.field === "gymPhotos").map((item) => item.path);
    const fighterListPath = manifest.find((item) => item.field === "fighterListUpload")?.path ?? null;

    const insertResult = await insertApplicationCompatibly({
      id: sessionId,
      applicationReference: session.application_reference,
      idempotencyKey: application.idempotencyKey,
      payloadHash: application.payloadHash,
      normalizedGymName: application.normalizedGymName,
      normalizedEmail: application.normalizedEmail,
      gymName: application.gymName,
      cityCountry: application.cityCountry,
      country,
      region: getRegionFromCountry(country),
      contactPerson: application.contactPerson,
      email: application.email,
      phone: application.phone,
      websiteInstagram: application.websiteInstagram,
      disciplinesOffered: application.disciplinesOffered,
      logoPath,
      gymPhotoPaths,
      fighterListPath,
      promoVideoLink: application.promoVideoLink,
      reviewConsent: application.reviewConsent,
      followUpConsent: application.followUpConsent,
      bkfcAppAccessInterest: application.bkfcAppAccessInterest,
    }, async (payload) => {
      const { error: insertError } = await supabase.from("affiliate_applications").insert(payload);
      return { error: insertError };
    });
    if (insertResult.error) throw new Error("database_insert_failed");

    const { error: finalizeError } = await supabase
      .from("affiliate_application_upload_sessions")
      .update({ status: "finalized", application_id: sessionId, finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (finalizeError) {
      logApplicationEvent("warn", { applicationReference: session.application_reference, stage: "upload_session", code: "SESSION_FINALIZE_MARK_FAILED" });
    }

    const notification = await runNonCriticalNotification(() => sendApplicationNotifications({
      applicationId: sessionId!,
      applicationReference: session.application_reference,
      gymName: application.gymName,
      cityCountry: application.cityCountry,
      contactPerson: application.contactPerson,
      email: application.email,
      phone: application.phone,
      websiteInstagram: application.websiteInstagram,
      disciplinesOffered: application.disciplinesOffered,
      promoVideoLink: application.promoVideoLink,
      bkfcAppAccessInterest: application.bkfcAppAccessInterest,
      reviewConsent: application.reviewConsent,
      followUpConsent: application.followUpConsent,
      facilityPhotoCount: application.gymPhotos.length,
      fighterListSupplied: Boolean(application.fighterList),
    }));
    if (notification === "failed") {
      logApplicationEvent("warn", { applicationReference: session.application_reference, stage: "notification", code: "EMAIL_NOTIFICATION_FAILED", notification: "failed" });
    }
    logApplicationEvent("info", { applicationReference: session.application_reference, stage: "complete", code: "APPLICATION_RECEIVED", compatibilityMode: "full_schema", durationMs: Date.now() - startedAt });
    return success(session.application_reference);
  } catch (caught) {
    if (sessionId) {
      if (caught instanceof ApplicationError && manifest.length) {
        await supabase.storage.from(STORAGE_BUCKET).remove(manifest.map((item) => item.path));
      }
      await supabase.from("affiliate_application_upload_sessions")
        .update({ status: caught instanceof ApplicationError ? "failed" : "pending", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("status", "finalizing");
    }
    if (caught instanceof ApplicationError) return error(caught.code, caught.status, caught.field);
    logApplicationEvent("error", { stage: "finalize", code: "PERSISTENCE_UNAVAILABLE", durationMs: Date.now() - startedAt });
    return error("PERSISTENCE_UNAVAILABLE", 503);
  }
}
