"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export type AdjustStockInput = {
  productId: string;
  branchId: string;
  /** delta en unidad base: negativo = faltante, positivo = sobrante */
  delta: number;
  reason: string;
  kind: "merma" | "perdida" | "sobrante";
  supervisorEmail: string;
  supervisorPassword: string;
};

/**
 * Ajuste de inventario con ASIENTO y AUTORIZACIÓN JERÁRQUICA por contraseña.
 * Flujo: (1) valida las credenciales del supervisor con un cliente descartable
 * (no toca la sesión del operador); (2) aplica el ajuste con service-role vía
 * `apply_stock_adjustment`, que además exige que el autorizante tenga rango
 * (owner/admin/manager) y postea a MERMA (merma) o PERD (pérdida). Registra al
 * operador y al autorizante.
 */
export async function adjustStock(input: AdjustStockInput): Promise<{
  ok: boolean; error?: string; newQty?: number; valued?: number; account?: string;
}> {
  if (!input.productId || !input.branchId) return { ok: false, error: "Faltan datos del ajuste" };
  if (!input.delta || input.delta === 0) return { ok: false, error: "El ajuste no puede ser cero" };
  if (!input.supervisorEmail?.trim() || !input.supervisorPassword) {
    return { ok: false, error: "Falta la autorización del supervisor (email y contraseña)" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !svc) return { ok: false, error: "Autorización no disponible: falta configuración de servidor (service-role)" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const operator = userData.user?.id;
  if (!operator) return { ok: false, error: "Sin sesión" };

  // (1) Verificar la contraseña del supervisor SIN persistir sesión ni tocar la del operador
  const verifier = createRawClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: sup, error: supErr } = await verifier.auth.signInWithPassword({
    email: input.supervisorEmail.trim(),
    password: input.supervisorPassword,
  });
  if (supErr || !sup.user) {
    return { ok: false, error: "Autorización rechazada: email o contraseña del supervisor inválidos" };
  }
  const authorizer = sup.user.id;
  await verifier.auth.signOut();

  // (2) Aplicar con service-role. La RPC valida que el autorizante sea jerárquico.
  const admin = createRawClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("apply_stock_adjustment", {
    p_product: input.productId,
    p_branch: input.branchId,
    p_delta: input.delta,
    p_reason: input.reason?.trim() || "ajuste",
    p_kind: input.kind,
    p_operator: operator,
    p_authorizer: authorizer,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string; new_qty?: number; valued?: number; account?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo aplicar el ajuste" };

  revalidatePath("/stock");
  return { ok: true, newQty: res.new_qty, valued: res.valued, account: res.account };
}

export type LoadStockInput = {
  productId: string;
  branchId: string;
  base: number; // en unidad base (u. o kg)
  enteredQty: number;
  enteredUnit: string;
  source: "balanza" | "manual";
};

/** Persiste una carga de stock: registra el movimiento y actualiza el inventario.
 *  La RLS garantiza que el usuario sólo pueda operar sobre su organización. */
export async function loadStock(input: LoadStockInput): Promise<{ ok: boolean; qty?: number; error?: string }> {
  if (input.base <= 0) return { ok: false, error: "Cantidad inválida" };
  const supabase = await createClient();

  const { data: prod } = await supabase
    .from("products")
    .select("org_id")
    .eq("id", input.productId)
    .maybeSingle();
  if (!prod) return { ok: false, error: "Producto no encontrado" };

  const { error: movErr } = await supabase.from("stock_movements").insert({
    org_id: prod.org_id,
    product_id: input.productId,
    branch_id: input.branchId,
    qty_change: input.base,
    entered_qty: input.enteredQty,
    entered_unit: input.enteredUnit,
    reason: "carga",
    source: input.source,
  });
  if (movErr) return { ok: false, error: movErr.message };

  const { data: inv } = await supabase
    .from("inventory")
    .select("id, qty")
    .eq("product_id", input.productId)
    .eq("branch_id", input.branchId)
    .maybeSingle();

  let qty: number;
  if (inv) {
    qty = Number(inv.qty) + input.base;
    const { error } = await supabase
      .from("inventory")
      .update({ qty, updated_at: new Date().toISOString() })
      .eq("id", inv.id);
    if (error) return { ok: false, error: error.message };
  } else {
    qty = input.base;
    const { error } = await supabase.from("inventory").insert({
      org_id: prod.org_id,
      product_id: input.productId,
      branch_id: input.branchId,
      qty,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/stock");
  return { ok: true, qty };
}
