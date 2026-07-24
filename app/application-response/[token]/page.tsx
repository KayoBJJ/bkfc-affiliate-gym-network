import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatInformationRequestExpiry } from "@/lib/application/information-response-format";
import { getPublicInformationRequest } from "@/lib/application/information-response-server";
import { isInformationResponseEnabled } from "@/lib/config/server";
import { submitInformationResponseAction } from "./actions";
import { ResponseForm } from "./ResponseForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Application Response | BKFC Gym Network",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function InformationResponsePage({
  params,
}: {
  params: { token: string };
}) {
  if (!isInformationResponseEnabled()) notFound();
  const request = await getPublicInformationRequest(params.token);
  if (!request) notFound();
  const available = request.status === "open";

  return (
    <main className="response-page">
      <section className="panel response-panel">
        <p className="eyebrow">BKFC Gym Network</p>
        <h1>Secure information request</h1>
        <p className="response-intro">
          Application <strong>{request.applicationReference}</strong> for{" "}
          <strong>{request.gymName}</strong>
        </p>

        {available ? (
          <>
            <div className="response-request">
              <p className="admin-pipeline-group-label">Information requested</p>
              <h2>{request.requestSummary}</h2>
              {request.requestDetails ? <p>{request.requestDetails}</p> : null}
              <p className="response-expiry">
                This secure link expires{" "}
                {formatInformationRequestExpiry(request.expiresAt)}.
              </p>
            </div>
            <ResponseForm token={params.token} action={submitInformationResponseAction} />
          </>
        ) : (
          <div className="response-unavailable" role="status">
            <h2>Response link unavailable</h2>
            <p>
              This request is completed, expired, or has been replaced. Contact the BKFC
              team if you still need to provide information.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
