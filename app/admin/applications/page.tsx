import { AdminShell } from "@/components/admin/AdminShell";
import { ApplicationsAdminView } from "@/components/admin/ApplicationsAdminView";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getAffiliateApplications,
  getAllApplicationStageHistory,
} from "@/lib/admin/supabase";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage() {
  await requireAdminUser();

  const applications = await getAffiliateApplications();
  const stageHistory = await getAllApplicationStageHistory();

  return (
    <AdminShell
      title="Affiliate Intake Dashboard"
      description="Monitor incoming gym applications, spot region trends, and move submissions through review."
    >
      <ApplicationsAdminView
        applications={applications}
        stageHistory={stageHistory}
      />
    </AdminShell>
  );
}