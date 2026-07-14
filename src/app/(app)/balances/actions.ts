"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Cierra el período contable hasta la fecha indicada (inclusive). Sólo owner/admin.
 * Después de cerrar, el motor rechaza cualquier asiento con fecha ≤ ese día.
 */
export async function closePeriod(through: string): Promise<{ ok: boolean; error?: string; closedThrough?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: "Sólo un administrador puede cerrar el período" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_period", { p_org: ctx.orgId, p_through: through });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string; closed_through?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo cerrar el período" };

  revalidatePath("/balances");
  return { ok: true, closedThrough: res.closed_through };
}
