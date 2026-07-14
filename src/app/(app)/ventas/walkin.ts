"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Cliente ocasional (walk-in): crea/reutiliza un party por DNI+nombre para poder
 * cobrarle a alguien no registrado. Devuelve el party_id para usarlo como cliente
 * de la venta. La RPC es SECURITY DEFINER: deja crear el party incluso al cajero.
 */
export async function walkinCustomer(dni: string, name: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (!dni.trim() && !name.trim()) return { ok: false, error: "Ingresá el nombre o el DNI del cliente." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_walkin_customer", {
    p_org: ctx.orgId,
    p_dni: dni.trim() || null,
    p_name: name.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/cuentas");
  return { ok: true, id: data as string };
}
