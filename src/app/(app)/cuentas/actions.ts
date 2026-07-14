"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CobroInput = {
  partyId: string;
  amount: number;
  instrument: "efectivo" | "transferencia" | "cheque_tercero" | "tarjeta";
};

/** Registra un cobro y dispara el motor de conciliación (FIFO + sobrepago→crédito). */
export async function registerCobro(
  input: CobroInput,
): Promise<{ ok: boolean; error?: string; applied?: number; credit?: number }> {
  if (!(input.amount > 0)) return { ok: false, error: "Importe inválido" };
  const supabase = await createClient();

  const { data: party } = await supabase
    .from("parties")
    .select("org_id")
    .eq("id", input.partyId)
    .maybeSingle();
  if (!party) return { ok: false, error: "Cliente no encontrado" };

  const { data: pay, error: pErr } = await supabase
    .from("payments")
    .insert({
      org_id: party.org_id,
      party_id: input.partyId,
      direction: "cobro",
      amount: input.amount,
      remaining_amount: input.amount,
      status: "pendiente",
      reference: "Cobro " + input.instrument,
      source: "cobranza",
    })
    .select("id")
    .single();
  if (pErr || !pay) return { ok: false, error: pErr?.message ?? "No se pudo crear el pago" };

  const { error: iErr } = await supabase.from("instruments").insert({
    org_id: party.org_id,
    payment_id: pay.id,
    type: input.instrument,
    amount: input.amount,
  });
  if (iErr) return { ok: false, error: iErr.message };

  const { data, error } = await supabase.rpc("process_payment_match", { p_payment: pay.id });
  if (error) return { ok: false, error: error.message };

  const res = (data ?? {}) as { ok: boolean; error?: string; applied?: number; credit?: number };
  if (res.ok) {
    revalidatePath("/cuentas");
    revalidatePath("/valores");
    revalidatePath("/panel");
  }
  return res;
}
