import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { getBkfcIntegrationConfig } from "@/lib/config/server";
import { checkBkfcConnection } from "@/lib/integrations/bkfc/connection-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await checkBkfcConnection(params.id, {
      isAdmin: async () => { const session = await getAdminSession(); return !!session.user && session.isAllowed; },
      findApplication: async (id) => {
        const { data, error } = await createAdminSupabaseClient().from("affiliate_applications")
          .select("source_system,source_application_id").eq("id", id).maybeSingle();
        if (error) throw new Error("APPLICATION_LOOKUP_FAILED");
        return data;
      },
      getConfig: getBkfcIntegrationConfig,
    });
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch {
    return NextResponse.json({ code: "CONNECTION_CHECK_UNAVAILABLE" }, { status: 503, headers });
  }
}
