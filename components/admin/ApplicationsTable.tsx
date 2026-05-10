import Link from "next/link";
import type { AffiliateApplication } from "@/lib/admin/types";
import type { ApplicationIntelligence } from "@/lib/admin/intelligence";

type ApplicationsTableProps = {
  applications: AffiliateApplication[];
  intelligence: ApplicationIntelligence[];
  totalApplications: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatLocationValue(value: string | null) {
  return value?.trim() ? value : "Not set";
}

export function ApplicationsTable({
  applications,
  intelligence,
  totalApplications,
}: ApplicationsTableProps) {
  const intelligenceMap = Object.fromEntries(
    intelligence.map((item) => [item.id, item])
  );

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
                const applicationIntelligence = intelligenceMap[application.id];
                
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
                    className={`admin-stage-pill ${
                    applicationIntelligence?.stageClassName ?? ""
                 }`}
>
  {applicationIntelligence?.stageLabel ?? "Unknown"}
</span>
                  </td>


                   <td>
                     <span
                     className={`admin-table-friction-pill ${
                     applicationIntelligence?.frictionClassName ?? "friction-neutral"
                     }`}
               >
                 {applicationIntelligence?.frictionLabel ?? "No signal"}
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
