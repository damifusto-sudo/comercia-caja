"use server";

import { getContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

/** Email sintético del cajero: identifica su caja. */
const CAJA_DOMAIN = "@caja.comercia.local";

/**
 * Crea una CAJA nueva y su USUARIO CAJERO en un solo paso:
 *  (1) valida que quien llama sea administrador;
 *  (2) crea la cuenta del cajero (email sintético + PIN) con service-role;
 *  (3) crea la cash_register y la membership (rol cajero + sucursal + caja).
 * Todo con la clave de servidor → no expone credenciales al navegador.
 * Si un paso falla, revierte los anteriores.
 */
export async function createCajaConCajero(input: {
  cajaName: string; username: string; pin: string;
}): Promise<{ ok: boolean; error?: string; username?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (ctx.role === "cajero") return { ok: false, error: "Sólo un administrador puede crear cajas" };

  const name = input.cajaName.trim();
  const username = input.username.trim().toLowerCase();
  const pin = input.pin.trim();
  if (!name) return { ok: false, error: "Poné un nombre a la caja" };
  if (!/^[a-z0-9]{3,}$/.test(username)) return { ok: false, error: "Usuario inválido: sólo letras/números, mínimo 3" };
  if (pin.length < 4) return { ok: false, error: "El PIN debe tener al menos 4 dígitos" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) {
    return { ok: false, error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para crear usuarios de caja." };
  }

  // Sucursal de la org
  const supabase = await createClient();
  let branchId = ctx.branchId;
  if (!branchId) {
    const { data: b } = await supabase.from("branches").select("id").eq("org_id", ctx.orgId).order("created_at").limit(1).maybeSingle();
    branchId = b?.id ?? null;
  }
  if (!branchId) return { ok: false, error: "No hay sucursal para asignar la caja" };

  const admin = createRawClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

  // Usuario duplicado en la org
  const { data: dup } = await admin.from("cash_registers").select("id").eq("org_id", ctx.orgId).eq("username", username).maybeSingle();
  if (dup) return { ok: false, error: "Ya existe una caja con ese usuario" };

  // (1) crear la cuenta del cajero
  const email = username + CAJA_DOMAIN;
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email, password: pin, email_confirm: true, user_metadata: { full_name: name, is_cajero: true },
  });
  if (uErr || !created?.user) {
    const dupUser = uErr?.message?.toLowerCase().includes("already") || uErr?.message?.toLowerCase().includes("registered");
    return { ok: false, error: dupUser ? "Ese usuario ya está registrado" : (uErr?.message ?? "No se pudo crear el usuario") };
  }
  const userId = created.user.id;

  // (2) crear la caja
  const { data: caja, error: cErr } = await admin
    .from("cash_registers")
    .insert({ org_id: ctx.orgId, branch_id: branchId, name, username, active: true })
    .select("id").single();
  if (cErr || !caja) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: cErr?.message ?? "No se pudo crear la caja" };
  }

  // (3) membership cajero → su caja
  const { error: mErr } = await admin.from("memberships").insert({
    org_id: ctx.orgId, user_id: userId, role: "cajero", branch_id: branchId, cash_register_id: caja.id,
  });
  if (mErr) {
    await admin.from("cash_registers").delete().eq("id", caja.id);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: mErr.message };
  }

  revalidatePath("/usuarios");
  return { ok: true, username };
}

/** Activa/desactiva una caja (el cajero no puede entrar si está inactiva). */
export async function setCajaActive(cajaId: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (ctx.role === "cajero") return { ok: false, error: "Sin permiso" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_registers")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", cajaId).eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/usuarios");
  return { ok: true };
}
