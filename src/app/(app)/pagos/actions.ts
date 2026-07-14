"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PagoInput = {
  partyId: string;
  amount: number;
  instrument: "efectivo" | "transferencia" | "cheque_propio" | "retencion" | "caja_grande";
};

const INSTR: Record<PagoInput["instrument"], string> = {
  efectivo: "efectivo",
  transferencia: "transferencia",
  cheque_propio: "cheque_propio",
  retencion: "retencion",
  caja_grande: "efectivo", // el efectivo sale de la tesorería central
};

/** Registra un pago a proveedor y dispara el matching (FIFO sobre su cta cte). */
export async function registrarPago(
  input: PagoInput,
): Promise<{ ok: boolean; error?: string; applied?: number; credit?: number }> {
  if (!(input.amount > 0)) return { ok: false, error: "Importe inválido" };
  const supabase = await createClient();

  const { data: party } = await supabase.from("parties").select("org_id").eq("id", input.partyId).maybeSingle();
  if (!party) return { ok: false, error: "Proveedor no encontrado" };

  const { data: pay, error: pErr } = await supabase
    .from("payments")
    .insert({
      org_id: party.org_id,
      party_id: input.partyId,
      direction: "pago",
      amount: input.amount,
      remaining_amount: input.amount,
      status: "pendiente",
      reference: "Pago " + input.instrument,
      source: "pago",
    })
    .select("id")
    .single();
  if (pErr || !pay) return { ok: false, error: pErr?.message ?? "No se pudo crear el pago" };

  const { error: iErr } = await supabase.from("instruments").insert({
    org_id: party.org_id,
    payment_id: pay.id,
    type: INSTR[input.instrument],
    amount: input.amount,
  });
  if (iErr) return { ok: false, error: iErr.message };

  const { data, error } = await supabase.rpc("process_payment_match", { p_payment: pay.id });
  if (error) return { ok: false, error: error.message };

  const res = (data ?? {}) as { ok: boolean; error?: string; applied?: number; credit?: number };
  if (res.ok) {
    revalidatePath("/pagos");
    revalidatePath("/panel");
  }
  return res;
}
