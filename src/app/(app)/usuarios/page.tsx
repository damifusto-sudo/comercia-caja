import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import UsuariosClient, { type CajaRow } from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const ctx = await requireContext();
  if (ctx.role === "cajero") redirect("/caja"); // gestión de cajas = admin

  const supabase = await createClient();
  const { data: cajas } = await supabase
    .from("cash_registers")
    .select("id, name, username, active, branches(name)")
    .eq("org_id", ctx.orgId)
    .order("name");

  const rows: CajaRow[] = (cajas ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    username: c.username ?? null,
    active: !!c.active,
    branch: (c.branches as unknown as { name: string } | null)?.name ?? null,
  }));

  return <UsuariosClient cajas={rows} orgName={ctx.orgName} />;
}
