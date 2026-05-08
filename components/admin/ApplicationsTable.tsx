import Link from "next/link";
import { formatLabel, getStageClass } from "@/lib/admin/formatLabel";
import type { AffiliateApplication } from "@/lib/admin/types";

type ApplicationsTableProps = {
  applications: AffiliateApplication[];
  totalApplications: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLocationValue(value: string | null) {
  return value?.trim() ? value : "Not set";
}

const stageThresholds: Record<string, number> = {
  submitted: 3,
  under_review: 7,
  follow_up_required: 5,
  interview: 7,
  trial_candidate: 14,
  approved: 14,
  activated_affiliate: 30,
  rejected: 30,
};

function getDaysInStage(createdAt: string) {
  const now = new Date();
  const createdDate = new Date(createdAt);

  return Math.max(
    0,
    Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function getApplicationFriction(reviewStage: string, createdAt: string) {
  const threshold = stageThresholds[reviewStage] ?? 7;
  const daysInStage = getDaysInStage(createdAt);

  if (daysInStage >= threshold) {
    return {
      label: `Stuck ${daysInStage}d`,
      className: "friction-stuck",
    };
  }

  if (daysInStage >= threshold * 0.7) {
    return {
      label: `Slowing ${daysInStage}d`,
      className: "friction-slowing",
    };
  }

  return {
    label: `Healthy ${daysInStage}d`,
    className: "friction-healthy",
  };
}

export function ApplicationsTable({
  applications,
  totalApplications,
}: ApplicationsTableProps) {
  return (
    <section className="panel admin-table-panel">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Applications</p>
          <h2>Affiliate intake list</h2>
          <p className="admin-overview-copy">
            Showing {applications.length} of {totalApplications} applications
          </p>
        </div>
        <p className="admin-results-copy">{applications.length} visible records</p>
      </div>

      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Gym name</th>
              <th>Country</th>
              <th>Region</th>
              <th>Contact person</th>
              <th>Email</th>
              <th>Status</th>
              <th>Friction</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {applications.length > 0 ? (
              applications.map((application) => {
                const friction = getApplicationFriction(
                  application.review_stage,
                  application.created_at
                );
                
                return (
                  <tr key={application.id}>
                  
                  <td className="admin-table-gym">{application.gym_name}</td>
                  <td className="admin-table-location">
                    {formatLocationValue(application.country)}
                  </td>
                  <td className="admin-table-location">
                    {formatLocationValue(application.region)}
                  </td>
                  <td className="admin-table-contact">{application.contact_person}</td>
                  <td className="admin-cell-wrap">{application.email}</td>
                  <td>
                    <span
                      className={`admin-stage-pill ${getStageClass(application.review_stage)}`}
                    >
                      {formatLabel(application.review_stage)}
                    </span>
                  </td>


                   <td>
                     <span className={`admin-table-friction-pill ${friction.className}`}>
                      {friction.label}
                     </span>
                   </td>

                  <td className="admin-table-date">{formatDate(application.created_at)}</td>
                  <td>
                    <Link
                      href={`/admin/applications/${application.id}`}
                      className="secondary-button admin-table-link"
                    >
                      View
                    </Link>
                  </td>
                </tr>
  );
})
            ) : (
              <tr>
                <td colSpan={9} className="admin-empty-state">
                  No applications match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
