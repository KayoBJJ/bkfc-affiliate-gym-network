import type { Metadata } from "next";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { APPLICANT_PROGRESS_MILESTONES } from "@/lib/application/applicant-portal";
import { getApplicantPortalView } from "@/lib/application/applicant-portal-server";
import { isApplicantPortalEnabled } from "@/lib/config/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Application Progress | BKFC Gym Network",
  description: "Private BKFC Gym Network application progress portal.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function requestStatusLabel(status: string) {
  if (status === "open") return "Action required";
  if (status === "responded") return "Response received";
  if (status === "expired") return "Link expired";
  return "Closed";
}

export default async function ApplicantProgressPage({
  params,
}: {
  params: { token: string };
}) {
  noStore();
  if (!isApplicantPortalEnabled()) notFound();
  const portal = await getApplicantPortalView(params.token);
  if (!portal) notFound();
  const hasOpenRequest = portal.requests.some((request) => request.status === "open");

  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <Image
            src="/bkfc-logo.png"
            width={188}
            height={70}
            alt="BKFC"
            className="portal-logo"
            priority
          />
          <div className="portal-security-note">
            <span aria-hidden="true">●</span>
            Private application view
          </div>
        </header>

        <section className={`portal-status-card tone-${portal.progress.tone}`}>
          <div className="portal-status-copy">
            <p className="eyebrow">BKFC Gym Network · Application progress</p>
            <span className="portal-status-pill">{portal.progress.label}</span>
            <h1>{portal.progress.headline}</h1>
            <p>{portal.progress.description}</p>
          </div>
          <dl className="portal-reference-card">
            <div>
              <dt>Gym</dt>
              <dd>{portal.gymName}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{portal.applicationReference}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(portal.submittedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="portal-progress-section" aria-labelledby="progress-title">
          <div className="portal-section-heading">
            <div>
              <p className="eyebrow">Where you are</p>
              <h2 id="progress-title">Application pathway</h2>
            </div>
            <strong>{portal.progress.progress}%</strong>
          </div>
          <div
            className="portal-progress-bar"
            role="progressbar"
            aria-label="Application progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={portal.progress.progress}
          >
            <span style={{ width: `${portal.progress.progress}%` }} />
          </div>
          <ol className="portal-milestones">
            {APPLICANT_PROGRESS_MILESTONES.map((milestone, index) => {
              const state =
                index < portal.progress.activeMilestone
                  ? "complete"
                  : index === portal.progress.activeMilestone
                    ? "current"
                    : "upcoming";
              return (
                <li key={milestone.label} className={state}>
                  <span className="portal-milestone-marker" aria-hidden="true">
                    {state === "complete" ? "✓" : index + 1}
                  </span>
                  <div>
                    <strong>{milestone.label}</strong>
                    <p>{milestone.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          className={`portal-action-card ${hasOpenRequest ? "needs-action" : ""}`}
          aria-labelledby="action-title"
        >
          <div className="portal-section-heading">
            <div>
              <p className="eyebrow">{hasOpenRequest ? "Your action" : "Updates"}</p>
              <h2 id="action-title">
                {hasOpenRequest ? "Information requested" : "No action required"}
              </h2>
            </div>
          </div>
          {portal.requests.length ? (
            <div className="portal-request-list">
              {portal.requests.map((request) => (
                <article key={request.id} className="portal-request">
                  <div className="portal-request-header">
                    <div>
                      <span className={`portal-request-status ${request.status}`}>
                        {requestStatusLabel(request.status)}
                      </span>
                      <h3>{request.summary}</h3>
                    </div>
                    <span className="portal-request-date">
                      {request.status === "open"
                        ? `Due ${formatDate(request.expiresAt)}`
                        : request.respondedAt
                          ? `Received ${formatDate(request.respondedAt)}`
                          : formatDate(request.expiresAt)}
                    </span>
                  </div>
                  {request.details ? <p>{request.details}</p> : null}
                  {request.latestFileStatus ? (
                    <p className="portal-file-state">
                      File version {request.latestFileVersion} ·{" "}
                      {request.latestFileStatus.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  {request.replacementInstructions ? (
                    <div className="portal-replacement-note">
                      <strong>Replacement requested</strong>
                      <p>{request.replacementInstructions}</p>
                    </div>
                  ) : null}
                  {request.status === "open" ? (
                    <p className="portal-request-help">
                      Use the secure response link supplied by the BKFC team. If the
                      link is unavailable, reply to your BKFC contact to request a new one.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p>
              The BKFC team has everything it needs right now. This page will reflect
              future progress without sending an email for every internal review step.
            </p>
          )}
        </section>

        <footer className="portal-footer">
          <p>
            Keep this private link confidential. It provides access to your application
            progress.
          </p>
          <p>BKFC Gym Network</p>
        </footer>
      </div>
    </main>
  );
}
