import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ComprasClient, { type OCView } from "./ComprasClient";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [, m, day] = d.split("-");
  return day && m ? `${day}/${m}` : d;
}

export default async function ComprasPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  let branchId = ctx.branchId;
  if (!branchId) {
    const { data: b } = await supabase
      .from("branches")
      .select("id")
      .eq("org_id", ctx.orgId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    branchId = b?.id ?? null;
  }

  const { data } = await supabase
    .from("purchase_orders")
    .select(
      "id, code, status, order_date, suppliers(name), purchase_order_items(id, description, qty, received_qty, unit_cost, products(sku, name, categories(name)))",
    )
    .order("code");

  const ordenes: OCView[] = (data ?? []).map((po) => {
    const sup = po.suppliers as unknown as { name: string } | null;
    return {
      poId: po.id,
      code: po.code ?? "",
      prov: sup?.name ?? "—",
      fecha: fmtDate(po.order_date),
      status: po.status as OCView["status"],
      items: (po.purchase_order_items ?? []).map((it) => {
        const p = it.products as unknown as { sku: string; name: string; categories: { name: string } | null } | null;
        return {
          itemId: it.id,
          art: p?.name ?? it.description ?? "—",
          sec: p?.categories?.name ?? "",
          sku: p?.sku ?? "",
          cant: Number(it.qty),
          recibido: Number(it.received_qty ?? 0),
          costo: Number(it.unit_cost),
        };
      }),
    };
  });

  return <ComprasClient ordenes={ordenes} branchId={branchId} />;
}
