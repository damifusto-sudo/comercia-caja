"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ClienteInput = {
  id?: string;
  name: string;
  taxId?: string;
  kind?: "cliente" | "ambos";
  classification?: string; // minorista / mayorista / …
  taxCondition?: string; // Responsable Inscripto / Monotributo / Consumidor Final / Exento
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  creditLimit?: number;
  notes?: string;
};

/** Crea o edita la ficha de un cliente (tabla parties). RLS: manager+ con
 *  suscripción activa; multi-tenant por org_id. */
export async function upsertCliente(input: ClienteInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!input.name?.trim()) return { ok: false, error: "El nombre es obligatorio." };
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const row = {
    org_id: ctx.orgId,
    name: input.name.trim(),
    tax_id: input.taxId?.trim() || null,
    kind: input.kind === "ambos" ? "ambos" : "cliente",
    classification: input.classification?.trim() || null,
    tax_condition: input.taxCondition?.trim() || "consumidor_final", // enum public.tax_condition (not null)
    contact_name: input.contactName?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    credit_limit: input.creditLimit && input.creditLimit > 0 ? input.creditLimit : 0,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("parties")
      .update(row)
      .eq("id", input.id)
      .eq("org_id", ctx.orgId)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "No se encontró el cliente o no tenés permiso." };
    revalidatePath("/clientes");
    revalidatePath("/cuentas");
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase.from("parties").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/cuentas");
  return { ok: true, id: data.id };
}
