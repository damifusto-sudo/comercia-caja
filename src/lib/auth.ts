import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Ctx = {
  userId: string;
  email: string;
  fullName: string;
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "manager" | "cajero";
  branchId: string | null;
  cajaId: string | null;
  isSuperadmin: boolean;
};

/**
 * Contexto del usuario actual (sesión + membresía + org + rol). null si no hay
 * sesión. Memoizado por request con cache(): el layout y la página lo comparten
 * (una sola verificación por navegación en vez de dos). Las consultas de
 * membresía y perfil van en paralelo.
 */
export const getContext = cache(async (): Promise<Ctx | null> => {
  const supabase = await createClient();
  // El middleware (proxy.ts → updateSession) ya validó y refrescó la sesión con
  // getUser() en este mismo request. Acá leemos la sesión LOCAL (getSession, sin
  // viaje de red al auth de Supabase) para no duplicar esa latencia en cada
  // navegación. El `sub` lo firma el auth server (no es falsificable) y toda
  // operación real la revalida la RLS, así que es rápido y seguro.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  // Filtrar SIEMPRE por el usuario actual: la RLS de memberships también expone
  // las membresías de otros usuarios a un owner/admin de la org, así que sin este
  // filtro .limit(1) podría devolver la fila de otro usuario (rol/caja equivocados).
  const [mRes, pRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("org_id, role, branch_id, cash_register_id, organizations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, email, is_superadmin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const m = mRes.data;
  const p = pRes.data;

  const isSuperadmin = !!p?.is_superadmin;

  if (!m) {
    return {
      userId: user.id,
      email: p?.email ?? user.email ?? "",
      fullName: p?.full_name ?? "",
      orgId: "",
      orgName: "",
      role: "cajero",
      branchId: null,
      cajaId: null,
      isSuperadmin,
    };
  }

  const org = m.organizations as unknown as { name: string } | null;
  return {
    userId: user.id,
    email: p?.email ?? user.email ?? "",
    fullName: p?.full_name ?? "",
    orgId: m.org_id,
    orgName: org?.name ?? "",
    role: m.role,
    branchId: m.branch_id,
    cajaId: m.cash_register_id,
    isSuperadmin,
  };
});

export async function requireContext(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  return ctx;
}
