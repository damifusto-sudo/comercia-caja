"use server";

import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ServiceInput = {
  subaccount: string;
  provider: string;
  taxId: string;
  concept: string;
  docDate: string;
  dueDate: string;
  gross: number;
  vatRate: number;
  costCenter: string;
};

/** Registra una factura de servicio (gas, luz, internet…): queda pendiente de
 *  pago con su vencimiento, y genera el asiento (Debe Servicios+IVA / Haber Proveedores). */
export async function createServiceInvoice(input: ServiceInput): Promise<{ ok: boolean; error?: string }> {
  if (!(input.gross > 0)) return { ok: false, error: "Importe inválido" };
  if (!input.provider.trim()) return { ok: false, error: "Falta el proveedor" };
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("register_service_invoice", {
    p_org: ctx.orgId,
    p_subaccount: input.subaccount,
    p_provider: input.provider.trim(),
    p_taxid: input.taxId,
    p_concept: input.concept,
    p_doc_date: input.docDate || null,
    p_due_date: input.dueDate || null,
    p_gross: input.gross,
    p_vat_rate: input.vatRate,
    p_cost_center: input.costCenter,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string };
  if (res.ok) {
    revalidatePath("/servicios");
    revalidatePath("/pagos");
    revalidatePath("/mayor");
  }
  return res;
}

/** Paga una factura de servicio (dispara el matching sobre la cta cte del proveedor). */
export async function pagarServicio(input: {
  partyId: string;
  amount: number;
  instrument: "efectivo" | "transferencia" | "cheque_propio";
}): Promise<{ ok: boolean; error?: string; applied?: number }> {
  if (!(input.amount > 0)) return { ok: false, error: "Importe inválido" };
  const supabase = await createClient();
  const { data: party } = await supabase.from("parties").select("org_id").eq("id", input.partyId).maybeSingle();
  if (!party) return { ok: false, error: "Proveedor no encontrado" };

  const { data: pay, error: pErr } = await supabase
    .from("payments")
    .insert({ org_id: party.org_id, party_id: input.partyId, direction: "pago", amount: input.amount, remaining_amount: input.amount, status: "pendiente", reference: "Pago servicio" })
    .select("id").single();
  if (pErr || !pay) return { ok: false, error: pErr?.message ?? "No se pudo crear el pago" };
  await supabase.from("instruments").insert({ org_id: party.org_id, payment_id: pay.id, type: input.instrument, amount: input.amount });

  const { data, error } = await supabase.rpc("process_payment_match", { p_payment: pay.id });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string; applied?: number };
  if (res.ok) {
    revalidatePath("/servicios");
    revalidatePath("/pagos");
    revalidatePath("/mayor");
  }
  return res;
}
