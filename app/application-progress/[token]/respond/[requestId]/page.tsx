import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { ResponseForm } from "@/app/application-response/[token]/ResponseForm";
import { submitInformationResponseAction } from "@/app/application-response/[token]/actions";
import { formatInformationRequestExpiry } from "@/lib/application/information-response-format";
import { getPortalInformationRequest } from "@/lib/application/information-response-server";
import {
  isApplicantPortalActionsEnabled,
  isApplicantPortalEnabled,
  isInformationResponseEnabled,
} from "@/lib/config/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Secure Portal Response | BKFC Gym Network",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function unavailableCopy(status: "responded" | "revoked" | "expired") {
  if (status === "responded") {
    return {
      title: "Response received",
      message: "BKFC has received this response and can now continue its review.",
    };
  }
  if (status === "expired") {
    return {
      title: "Request expired",
      message:
        "This request is no longer accepting responses. Contact the BKFC team if you still need to provide information.",
    };
  }
  return {
    title: "Request replaced",
    message:
      "This request has been closed or replaced by a newer request. Return to your portal for the current action.",
  };
}

export default async function PortalInformationResponsePage({
  params,
}: {
  params: { token: string; requestId: string };
}) {
  noStore();
  if (
    !isApplicantPortalEnabled() ||
    !isApplicantPortalActionsEnabled() ||
    !isInformationResponseEnabled()
  ) {
    notFound();
  }

  const request = await getPortalInformationRequest(params.token, params.requestId);
  if (!request) notFound();
  const unavailable = request.status === "open" ? null : unavailableCopy(request.status);

  return (
    <main className="response-page">
      <section className="panel response-panel">
        <p className="eyebrow">BKFC Gym Network · Private applicant portal</p>
        <h1>Secure information request</h1>
        <p className="response-intro">
          Application <strong>{request.applicationReference}</strong> for{" "}
          <strong>{request.gymName}</strong>
        </p>

        {!unavailable ? (
          <>
            <div className="response-request">
              <p className="admin-pipeline-group-label">Information requested</p>
              <h2>{request.requestSummary}</h2>
              {request.requestDetails ? <p>{request.requestDetails}</p> : null}
              {request.replacementInstructions ? (
                <div className="response-replacement-note">
                  <strong>Replacement requested</strong>
                  <p>{request.replacementInstructions}</p>
                </div>
              ) : null}
              <p className="response-expiry">
                This request expires {formatInformationRequestExpiry(request.expiresAt)}.
              </p>
            </div>
            <ResponseForm
              credential={{
                kind: "portal",
                token: params.token,
                requestId: request.id,
              }}
              action={submitInformationResponseAction}
            />
          </>
        ) : (
          <div className="response-unavailable" role="status">
            <h2>{unavailable.title}</h2>
            <p>{unavailable.message}</p>
          </div>
        )}

        <p className="response-portal-return">
          <a href={`/application-progress/${params.token}`}>Return to application progress</a>
        </p>
      </section>
    </main>
  );
}
