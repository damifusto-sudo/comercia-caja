"use server";

import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type Res = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/sucursales");
  revalidatePath("/stock");
  revalidatePath("/panel");
}

export async function createBranch(name: string, address: string): Promise<Res> {
  const ctx = await requireContext();
  if (!ctx.orgId) return { ok: false, error: "Sin comercio asociado" };
  if (!name.trim()) return { ok: false, error: "El nombre de la sucursal es obligatorio" };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({ org_id: ctx.orgId, name: name.trim(), address: address.trim() || null });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function updateBranch(id: string, name: string, address: string): Promise<Res> {
  const ctx = await requireContext();
  if (!name.trim()) return { ok: false, error: "El nombre es obligatorio" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .update({ name: name.trim(), address: address.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Sucursal no encontrada" };
  refresh();
  return { ok: true };
}

export async function toggleBranch(id: string, active: boolean): Promise<Res> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Sucursal no encontrada" };
  refresh();
  return { ok: true };
}
