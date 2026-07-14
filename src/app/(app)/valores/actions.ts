"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Avanza el estado de un cheque (depositar / acreditar / rechazar / endosar),
 *  disparando el asiento contable correspondiente. */
export async function chequeTransition(
  chequeId: string,
  to: "depositado" | "acreditado" | "rechazado",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cheque_transition", { p_cheque: chequeId, p_to: to });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok: boolean; error?: string };
  if (res.ok) {
    revalidatePath("/valores");
    revalidatePath("/panel");
  }
  return res;
}
