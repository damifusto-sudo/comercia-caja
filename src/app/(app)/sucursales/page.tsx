import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SucursalesClient, { type Sucursal } from "./SucursalesClient";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address, active")
    .eq("org_id", ctx.orgId)
    .order("created_at");

  const ids = (branches ?? []).map((b) => b.id);
  const { data: cajas } = ids.length
    ? await supabase.from("cash_registers").select("id, branch_id").eq("org_id", ctx.orgId)
    : { data: [] as { id: string; branch_id: string | null }[] };

  const cajaCount = new Map<string, number>();
  for (const c of cajas ?? []) if (c.branch_id) cajaCount.set(c.branch_id, (cajaCount.get(c.branch_id) ?? 0) + 1);

  const sucursales: Sucursal[] = (branches ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address ?? "",
    active: b.active ?? true,
    cajas: cajaCount.get(b.id) ?? 0,
  }));

  return <SucursalesClient sucursales={sucursales} canEdit={ctx.role !== "cajero"} />;
}
