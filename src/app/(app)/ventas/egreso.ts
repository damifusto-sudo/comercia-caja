"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type EgresoKind = "gasto" | "retiro";

/**
 * Registra un egreso de caja (gasto / retiro): salida de efectivo con asiento
 * Debe SRV/OTEG · Haber CAJA (via RPC register_egreso, security definer).
 * El pago a proveedor va por su propio circuito (pagarProveedor).
 */
export async function registrarEgreso(
  kind: EgresoKind,
  concepto: string,
  amount: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (!(amount > 0)) return { ok: false, error: "Ingresá un importe mayor a cero." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_egreso", {
    p_org: ctx.orgId,
    p_kind: kind,
    p_concept: concepto?.trim() || null,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo registrar el egreso" };

  revalidatePath("/caja");
  revalidatePath("/panel");
  revalidatePath("/mayor");
  return { ok: true };
}
