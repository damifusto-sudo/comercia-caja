import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ComercioClient, { type CommerceForm } from "./ComercioClient";

export const dynamic = "force-dynamic";

export default async function ComercioPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, legal_name, tax_id, tax_condition, address, gross_income, activity_start, logo")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const initial: CommerceForm = {
    name: org?.name ?? "",
    legalName: org?.legal_name ?? "",
    taxId: org?.tax_id ?? "",
    taxCondition: (org?.tax_condition as CommerceForm["taxCondition"]) ?? "responsable_inscripto",
    address: org?.address ?? "",
    grossIncome: org?.gross_income ?? "",
    activityStart: (org?.activity_start as string | null) ?? "",
    logo: org?.logo ?? null,
  };

  return <ComercioClient initial={initial} canEdit={ctx.role === "owner" || ctx.role === "admin"} />;
}
