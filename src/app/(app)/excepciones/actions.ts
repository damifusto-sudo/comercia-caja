"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type RpcRes = { ok: boolean; error?: string; applied?: number; credit?: number; credit_left?: number; written_off?: number };

function refresh() {
  revalidatePath("/excepciones");
  revalidatePath("/cuentas");
  revalidatePath("/pagos");
  revalidatePath("/valores");
  revalidatePath("/panel");
}

async function requireResolver(): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (ctx.role === "cajero") return { ok: false, error: "Sólo administración puede resolver excepciones" };
  return { ok: true, orgId: ctx.orgId };
}

/** Reintenta la conciliación de un pago que quedó sin aplicar (FIFO + sobrepago→crédito). */
export async function retryMatch(paymentId: string): Promise<RpcRes> {
  const g = await requireResolver();
  if (!g.ok) return { ok: false, error: g.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_payment_match", { p_payment: paymentId });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as RpcRes;
  if (res.ok) refresh();
  return res;
}

/** Anula un pago sin conciliar (aún no generó asientos). */
export async function voidPayment(paymentId: string): Promise<RpcRes> {
  const g = await requireResolver();
  if (!g.ok) return { ok: false, error: g.error };
  const supabase = await createClient();
  // Acota a la org del contexto: el rol se validó contra esa org, así que la
  // fila afectada debe pertenecer a la misma (evita anular pagos de otra org
  // en la que el usuario sea sólo cajero).
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "anulado" })
    .eq("id", paymentId)
    .eq("org_id", g.orgId)
    .eq("status", "pendiente")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "El pago no existe, no está pendiente o no pertenece a tu organización" };
  refresh();
  return { ok: true };
}

/** Aplica un crédito a favor a una factura abierta del mismo party. */
export async function applyCreditTo(creditId: string, documentId: string, amount: number): Promise<RpcRes> {
  const g = await requireResolver();
  if (!g.ok) return { ok: false, error: g.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_credit", {
    p_credit: creditId,
    p_document: documentId,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as RpcRes;
  if (res.ok) refresh();
  return res;
}

/** Da de baja un crédito a favor irrecuperable (asiento a Otros ingresos/egresos). */
export async function writeoffCredit(creditId: string): Promise<RpcRes> {
  const g = await requireResolver();
  if (!g.ok) return { ok: false, error: g.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("writeoff_credit", { p_credit: creditId });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as RpcRes;
  if (res.ok) refresh();
  return res;
}
