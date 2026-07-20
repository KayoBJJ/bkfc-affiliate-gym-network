import type { ReactNode } from "react";
import { formatLabel, getStageClass } from "@/lib/admin/formatLabel";
import type { AffiliateApplication } from "@/lib/admin/types";

type ApplicationDetailPanelProps = {
  application: AffiliateApplication;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-detail-item">
      <p className="admin-detail-label">{label}</p>
      <div className="admin-detail-value">{children}</div>
    </div>
  );
}

function MaybeLink({ href }: { href: string | null }) {
  if (!href) {
    return <span className="admin-empty-copy">Not provided</span>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className="admin-inline-link">
      {href}
    </a>
  );
}

function formatLocationValue(value: string | null) {
  return value?.trim() ? value : "Not set";
}

export function ApplicationDetailPanel({ application }: ApplicationDetailPanelProps) {
  const logoAccessUrl = application.logo_access_url || application.logo_url;
  const photoAccessUrls = application.gym_photo_access_urls || application.gym_photo_urls;
  const fighterListAccessUrl = application.fighter_list_access_url || application.fighter_list_url;

  return (
    <section className="panel admin-detail-panel">
      <div className="section-heading">
        <p className="eyebrow">Application Detail</p>
        <div className="admin-detail-heading">
          <h2>{application.gym_name}</h2>
          <span
            className={`admin-stage-pill admin-stage-pill-strong ${getStageClass(
              application.review_stage
            )}`}
          >
            {formatLabel(application.review_stage)}
          </span>
        </div>
      </div>

      <div className="admin-detail-grid">
        <Field label="Application reference">
          {application.application_reference || application.id}
        </Field>
        <Field label="City / Country">{application.city_country}</Field>
        <Field label="Country">{formatLocationValue(application.country)}</Field>
        <Field label="Region">{formatLocationValue(application.region)}</Field>
        <Field label="Contact person">{application.contact_person}</Field>
        <Field label="Email">{application.email}</Field>
        <Field label="Phone">{application.phone}</Field>
        <Field label="Website / social">
          <MaybeLink href={application.website_instagram} />
        </Field>
        <Field label="Promo video link">
          <MaybeLink href={application.promo_video_link} />
        </Field>
        <Field label="Fighter list link">
          <MaybeLink href={fighterListAccessUrl} />
        </Field>
        <Field label="Disciplines offered">
          {application.disciplines_offered || (
            <span className="admin-empty-copy">Not provided</span>
          )}
        </Field>
        <Field label="Review consent">{application.review_consent ? "Yes" : "No"}</Field>
        <Field label="Follow-up consent">{application.follow_up_consent ? "Yes" : "No"}</Field>
        <Field label="BKFC App access interest">
          {application.bkfc_app_access_interest ? "Yes" : "No"}
        </Field>
        <Field label="Status">{formatLabel(application.status)}</Field>
        <Field label="Review stage">{formatLabel(application.review_stage)}</Field>
      </div>

      <div className="admin-media-grid">
        <article className="admin-media-card">
          <p className="admin-detail-label">Logo preview</p>
          {logoAccessUrl ? (
            <>
              <img
                src={logoAccessUrl}
                alt={`${application.gym_name} logo`}
                className="admin-media-image admin-logo-image"
              />
              <a href={logoAccessUrl} target="_blank" rel="noreferrer" className="admin-inline-link">
                Open logo file
              </a>
            </>
          ) : (
            <p className="admin-empty-copy">No logo uploaded.</p>
          )}
        </article>

        <article className="admin-media-card">
          <p className="admin-detail-label">Gym photos</p>
          {photoAccessUrls && photoAccessUrls.length > 0 ? (
            <div className="admin-photo-grid">
              {photoAccessUrls.map((photoUrl) => (
                <a
                  key={photoUrl}
                  href={photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-photo-link"
                >
                  <img src={photoUrl} alt="Gym submission" className="admin-media-image" />
                </a>
              ))}
            </div>
          ) : (
            <p className="admin-empty-copy">No gym photos uploaded.</p>
          )}
        </article>
      </div>

      <article className="admin-notes-panel">
        <p className="admin-detail-label">Internal notes</p>
        <p>{application.internal_notes || "No internal notes added yet."}</p>
      </article>
    </section>
  );
}
