import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await requireContext();
  if (ctx.orgId) redirect("/caja");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as { org_name?: string; full_name?: string };

  return <OnboardingClient defaultOrg={meta.org_name ?? ""} defaultName={meta.full_name ?? ctx.fullName ?? ""} />;
}
