"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type RecRes = { ok: boolean; error?: string; lines?: number; received?: number; complete?: boolean };

function refresh() {
  revalidatePath("/compras");
  revalidatePath("/stock");
  revalidatePath("/panel");
  revalidatePath("/pagos");
}

/** Confirma una orden en borrador (borrador → confirmada) habilitando su recepción.
 *  Vía RPC confirm_po: EXIGE que toda línea quede vinculada a un producto real
 *  (lo busca o lo crea) → integridad referencial Compras↔Inventario garantizada. */
export async function confirmOrder(poId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_po", { p_po: poId });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo confirmar la orden" };
  refresh();
  return { ok: true };
}

/** Cierra una orden abierta con lo recibido (lo pendiente se da por no ingresado):
 *  si ingresó algo → 'recibida' + factura de compra por lo recibido; si no → 'anulada'. */
export async function finalizeOrder(
  poId: string,
): Promise<{ ok: boolean; error?: string; status?: string; invoice?: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finalize_po", { p_po: poId });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string; status?: string; invoice?: string | null };
  if (res.ok) refresh();
  return res;
}

/** Recibe TODO lo pendiente de la orden (recepción total). Atómico vía RPC. */
export async function receiveOrder(poId: string, branchId: string | null): Promise<RecRes> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_po_lines", {
    p_po: poId,
    p_lines: null,
    p_branch: branchId,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as RecRes;
  if (res.ok) refresh();
  return res;
}

/** Recibe cantidades por línea (recepción parcial). `lines`: [{ itemId, qty, lotCode?, expiry? }].
 *  lotCode/expiry (opcionales) quedan grabados en la capa de inventario → trazabilidad. */
export async function receiveOrderLines(
  poId: string,
  lines: { itemId: string; qty: number; lotCode?: string; expiry?: string }[],
  branchId: string | null,
): Promise<RecRes> {
  const clean = lines
    .filter((l) => l.qty > 0)
    .map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      lot_code: l.lotCode?.trim() || null,
      expiry: l.expiry?.trim() || null,
    }));
  if (clean.length === 0) return { ok: false, error: "Indicá al menos una cantidad a recibir" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_po_lines", {
    p_po: poId,
    p_lines: clean,
    p_branch: branchId,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as RecRes;
  if (res.ok) refresh();
  return res;
}
