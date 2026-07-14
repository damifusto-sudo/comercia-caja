import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SuscripcionClient from "./SuscripcionClient";

export const dynamic = "force-dynamic";

export default async function SuscripcionPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  let sub: { plan: string; status: string; trial_ends_at: string | null; current_period_end: string | null } | null = null;
  if (ctx.orgId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, trial_ends_at, current_period_end")
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    sub = data as typeof sub;
  }

  return (
    <SuscripcionClient
      sub={sub}
      canManage={ctx.role === "owner" || ctx.role === "admin"}
      orgName={ctx.orgName}
      hasOrg={!!ctx.orgId}
    />
  );
}
