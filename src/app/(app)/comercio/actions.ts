"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type CommerceInput = {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  taxCondition: "responsable_inscripto" | "monotributo" | "exento" | "consumidor_final";
  address?: string | null;
  grossIncome?: string | null;
  activityStart?: string | null;
  logo?: string | null; // data URL
};

/**
 * Guarda la identidad fiscal del comercio (nombre, razón social, CUIT, condición,
 * domicilio, IIBB, inicio de actividades y logo). Estos datos aparecen en los
 * comprobantes. Sólo owner/admin.
 */
export async function saveCommerce(input: CommerceInput): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: "Sólo un administrador puede editar los datos del comercio" };
  if (!input.name?.trim()) return { ok: false, error: "El nombre del comercio es obligatorio" };
  if (input.logo && input.logo.length > 700_000) return { ok: false, error: "El logo es muy pesado. Subí una imagen más liviana (se recomienda PNG/JPG chico)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      legal_name: input.legalName?.trim() || null,
      tax_id: input.taxId?.trim() || null,
      tax_condition: input.taxCondition,
      address: input.address?.trim() || null,
      gross_income: input.grossIncome?.trim() || null,
      activity_start: input.activityStart || null,
      logo: input.logo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/comercio");
  return { ok: true };
}
