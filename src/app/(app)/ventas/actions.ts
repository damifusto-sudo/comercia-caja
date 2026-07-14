"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type SaleLine = { productId: string; qty: number };
export type SaleMethod = "efectivo" | "tarjeta" | "transferencia" | "qr" | "cta_cte";
export type CreateSaleInput = {
  branchId: string;
  method: SaleMethod;
  lines: SaleLine[];
  /** cliente nombrado; null = Consumidor Final (obligatorio para cta_cte) */
  partyId?: string | null;
  /** medio de cobro (tarjeta/QR): aporta la comisión a descontar del neto */
  finAccountId?: string | null;
  ref?: string | null;
  /** identificador local único para sincronizar ventas offline sin duplicar */
  clientUid?: string | null;
};
export type CreateSaleResult = {
  ok: boolean;
  error?: string;
  docId?: string;
  number?: string;
  letter?: string;
  net?: number;
  vat?: number;
  total?: number;
  settlement?: "pendiente" | "pagado";
};

/**
 * Emite el comprobante de una venta (create_sale): genera un `documents` real
 * con letra (A/B/C), punto de venta y número correlativo, asienta por partida
 * doble y descuenta el stock. Contado → factura saldada (Debe CAJA/TARJ/BANCO);
 * cuenta corriente → factura a crédito (Debe CLI, cuenta por cobrar). Los
 * precios se toman del producto en la DB, no del cliente. El cajero puede
 * vender pero sólo en la sucursal de su caja (la RPC es security definer con
 * gate que lo verifica).
 */
export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  if (!input.branchId) return { ok: false, error: "Sin sucursal asignada para vender" };
  const lines = (input.lines ?? []).filter((l) => l.productId && l.qty > 0);
  if (!lines.length) return { ok: false, error: "Ticket vacío" };

  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", {
    p_org: ctx.orgId,
    p_branch: input.branchId,
    p_method: input.method,
    p_lines: lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
    p_party: input.partyId ?? null,
    p_ref: input.ref ?? null,
    p_fin_account: input.finAccountId ?? null,
    p_client_uid: input.clientUid ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const res = (data ?? {}) as {
    ok: boolean; error?: string; doc?: string; number?: string; letter?: string;
    net?: number; vat?: number; total?: number; settlement?: "pendiente" | "pagado";
  };
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo registrar la venta" };

  revalidatePath("/stock");
  revalidatePath("/panel");
  revalidatePath("/caja");
  revalidatePath("/cuentas");
  return {
    ok: true, docId: res.doc, number: res.number, letter: res.letter,
    net: res.net, vat: res.vat, total: res.total, settlement: res.settlement,
  };
}

export type CobroCuentaInput = {
  partyId: string;
  amount: number;
  instrument: "efectivo" | "transferencia" | "cheque_tercero" | "tarjeta";
  source: "ventas" | "caja";
  sourceRef?: string | null;
  /** medio de cobro real (tarjeta/QR/banco): su fee_rate se descuenta como comisión */
  finAccountId?: string | null;
};

export type CobroCuentaResult = {
  ok: boolean;
  error?: string;
  conciliated: boolean;
  applied?: number;
  credit?: number;
};

/**
 * Registra un cobro a la cuenta corriente de un cliente desde Ventas/POS o Caja
 * y lo pasa por el motor de conciliación (FIFO + sobrepago→crédito).
 * Si el operador no puede conciliar (cajero), el cobro queda **pendiente** y
 * aparece en la Bandeja de excepciones etiquetado con su origen (ventas/caja).
 */
export async function cobrarACuenta(input: CobroCuentaInput): Promise<CobroCuentaResult> {
  if (!(input.amount > 0)) return { ok: false, error: "Importe inválido", conciliated: false };
  if (!input.partyId) return { ok: false, error: "Elegí un cliente de cuenta corriente", conciliated: false };

  const supabase = await createClient();
  const { data: party } = await supabase.from("parties").select("org_id").eq("id", input.partyId).maybeSingle();
  if (!party) return { ok: false, error: "Cliente no encontrado", conciliated: false };

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
      source: input.source,
      source_ref: input.sourceRef ?? null,
    })
    .select("id")
    .single();
  if (pErr || !pay) return { ok: false, error: pErr?.message ?? "No se pudo registrar el cobro", conciliated: false };

  const { error: iErr } = await supabase.from("instruments").insert({
    org_id: party.org_id,
    payment_id: pay.id,
    type: input.instrument,
    amount: input.amount,
    fin_account_id: input.finAccountId ?? null,
  });
  if (iErr) return { ok: false, error: iErr.message, conciliated: false };

  const { data, error } = await supabase.rpc("process_payment_match", { p_payment: pay.id });
  revalidatePath("/excepciones");
  revalidatePath("/cuentas");
  revalidatePath("/panel");

  // Un error LANZADO por la RPC (p. ej. instrumentos ≠ importe, asiento
  // desbalanceado) es un fallo de integridad real: el cobro ya quedó registrado
  // pero no se pudo conciliar por un problema, no por permisos → hay que
  // mostrárselo al operador, no disfrazarlo de "pendiente normal".
  if (error) return { ok: true, conciliated: false, error: error.message };
  // La RPC devolvió datos: res.ok=false es el caso ESPERADO del cajero sin
  // permiso de conciliación (has_role / RLS) → el cobro queda pendiente en la
  // Bandeja de excepciones, sin error.
  const res = (data ?? {}) as { ok: boolean; error?: string; applied?: number; credit?: number };
  if (res.ok) return { ok: true, conciliated: true, applied: res.applied, credit: res.credit };
  return { ok: true, conciliated: false };
}

export type PagoProveedorInput = { partyId: string; amount: number; sourceRef?: string | null };

/**
 * Registra un PAGO en efectivo a un proveedor desde la Caja (egreso). Pasa por el
 * motor: imputa por FIFO a las facturas del proveedor (Debe Proveedores / Haber
 * Caja). Si el operador es cajero (no puede conciliar), queda **pendiente** en la
 * Bandeja de excepciones para que lo confirme un responsable.
 */
export async function pagarProveedor(input: PagoProveedorInput): Promise<CobroCuentaResult> {
  if (!(input.amount > 0)) return { ok: false, error: "Importe inválido", conciliated: false };
  if (!input.partyId) return { ok: false, error: "Elegí un proveedor", conciliated: false };

  const supabase = await createClient();
  const { data: party } = await supabase.from("parties").select("org_id").eq("id", input.partyId).maybeSingle();
  if (!party) return { ok: false, error: "Proveedor no encontrado", conciliated: false };

  const { data: pay, error: pErr } = await supabase
    .from("payments")
    .insert({
      org_id: party.org_id,
      party_id: input.partyId,
      direction: "pago",
      amount: input.amount,
      remaining_amount: input.amount,
      status: "pendiente",
      reference: "Pago efectivo (caja)",
      source: "caja",
      source_ref: input.sourceRef ?? null,
    })
    .select("id")
    .single();
  if (pErr || !pay) return { ok: false, error: pErr?.message ?? "No se pudo registrar el pago", conciliated: false };

  const { error: iErr } = await supabase.from("instruments").insert({
    org_id: party.org_id,
    payment_id: pay.id,
    type: "efectivo",
    amount: input.amount,
  });
  if (iErr) return { ok: false, error: iErr.message, conciliated: false };

  const { data, error } = await supabase.rpc("process_payment_match", { p_payment: pay.id });
  revalidatePath("/excepciones");
  revalidatePath("/cuentas");
  revalidatePath("/caja");
  revalidatePath("/panel");

  if (error) return { ok: true, conciliated: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string; applied?: number; credit?: number };
  if (res.ok) return { ok: true, conciliated: true, applied: res.applied, credit: res.credit };
  return { ok: true, conciliated: false };
}
