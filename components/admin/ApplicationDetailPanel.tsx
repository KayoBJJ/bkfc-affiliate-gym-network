import type { ReactNode } from "react";
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

export function ApplicationDetailPanel({ application }: ApplicationDetailPanelProps) {
  return (
    <section className="panel admin-detail-panel">
      <div className="section-heading">
        <p className="eyebrow">Application Detail</p>
        <div className="admin-detail-heading">
          <h2>{application.gym_name}</h2>
          <span className="admin-stage-pill admin-stage-pill-strong">
            Current stage: {application.review_stage}
          </span>
        </div>
      </div>

      <div className="admin-detail-grid">
        <Field label="City / Country">{application.city_country}</Field>
        <Field label="Country">{application.country}</Field>
        <Field label="Region">{application.region}</Field>
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
          <MaybeLink href={application.fighter_list_url} />
        </Field>
        <Field label="Disciplines offered">
          {application.disciplines_offered || (
            <span className="admin-empty-copy">Not provided</span>
          )}
        </Field>
        <Field label="Review consent">{application.review_consent ? "Yes" : "No"}</Field>
        <Field label="Follow-up consent">{application.follow_up_consent ? "Yes" : "No"}</Field>
        <Field label="Status">{application.status}</Field>
        <Field label="Review stage">{application.review_stage}</Field>
      </div>

      <div className="admin-media-grid">
        <article className="admin-media-card">
          <p className="admin-detail-label">Logo preview</p>
          {application.logo_url ? (
            <>
              <img
                src={application.logo_url}
                alt={`${application.gym_name} logo`}
                className="admin-media-image admin-logo-image"
              />
              <a href={application.logo_url} target="_blank" rel="noreferrer" className="admin-inline-link">
                Open logo file
              </a>
            </>
          ) : (
            <p className="admin-empty-copy">No logo uploaded.</p>
          )}
        </article>

        <article className="admin-media-card">
          <p className="admin-detail-label">Gym photos</p>
          {application.gym_photo_urls && application.gym_photo_urls.length > 0 ? (
            <div className="admin-photo-grid">
              {application.gym_photo_urls.map((photoUrl) => (
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
