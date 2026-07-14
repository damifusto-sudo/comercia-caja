"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Fija el objetivo de venta diario de la organización (sólo admin/owner por RLS). */
export async function setDailyTarget(value: number): Promise<{ ok: boolean; error?: string }> {
  if (!(value > 0)) return { ok: false, error: "Objetivo inválido" };
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ daily_target: value }).eq("id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel");
  return { ok: true };
}
