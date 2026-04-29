import Link from "next/link";
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
              <th>Review stage</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {applications.length > 0 ? (
              applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.gym_name}</td>
                  <td>{application.country}</td>
                  <td>{application.region}</td>
                  <td>{application.contact_person}</td>
                  <td className="admin-cell-wrap">{application.email}</td>
                  <td>
                    <span className="admin-stage-pill">{application.review_stage}</span>
                  </td>
                  <td>{formatDate(application.created_at)}</td>
                  <td>
                    <Link
                      href={`/admin/applications/${application.id}`}
                      className="secondary-button admin-table-link"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="admin-empty-state">
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
