import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProductosClient, { type ProdRow, type Cat, type ExpiryItem } from "./ProductosClient";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Sucursal de trabajo (la del usuario, o la primera de la org).
  let branchId = ctx.branchId;
  if (!branchId) {
    const { data: b } = await supabase
      .from("branches").select("id").eq("org_id", ctx.orgId).order("created_at").limit(1).maybeSingle();
    branchId = b?.id ?? null;
  }

  const DAYS = 30;
  const since = new Date(Date.now() - DAYS * 86400000).toISOString();

  const [prodsRes, catsRes, invRes, salesRes, pendRes, expRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, base_unit, is_weighed, cost, sale_price, min_stock, emoji, barcode, active, price_tier, price_manual, categories(name)")
      .eq("org_id", ctx.orgId)
      .order("name"),
    supabase.from("categories").select("id, name").eq("org_id", ctx.orgId).order("name"),
    branchId
      ? supabase.from("inventory").select("product_id, qty").eq("branch_id", branchId)
      : Promise.resolve({ data: [] as { product_id: string; qty: number }[] }),
    branchId
      ? supabase.from("stock_movements").select("product_id, qty_change").eq("branch_id", branchId).eq("reason", "venta").gte("created_at", since)
      : Promise.resolve({ data: [] as { product_id: string; qty_change: number }[] }),
    supabase
      .from("purchase_order_items")
      .select("product_id, qty, received_qty, purchase_orders!inner(status, branch_id)")
      .in("purchase_orders.status", ["en_transito", "confirmada"]),
    supabase.rpc("expiry_alerts", { p_org: ctx.orgId, p_days: 30 }),
  ]);

  const invMap = new Map((invRes.data ?? []).map((i) => [i.product_id, Number(i.qty)]));

  const soldMap = new Map<string, number>();
  for (const m of salesRes.data ?? []) {
    soldMap.set(m.product_id, (soldMap.get(m.product_id) ?? 0) + Math.abs(Number(m.qty_change)));
  }

  const pendMap = new Map<string, number>();
  for (const it of pendRes.data ?? []) {
    if (!it.product_id) continue;
    const po = it.purchase_orders as unknown as { branch_id: string | null } | null;
    const dest = po?.branch_id ?? null;
    if (dest && branchId && dest !== branchId) continue;
    const restante = Number(it.qty) - Number(it.received_qty ?? 0);
    if (restante <= 0) continue;
    pendMap.set(it.product_id, (pendMap.get(it.product_id) ?? 0) + restante);
  }

  const products: ProdRow[] = (prodsRes.data ?? []).map((p) => {
    const soldReal = (soldMap.get(p.id) ?? 0) / DAYS;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? "",
      baseUnit: (p.base_unit as "u" | "kg" | "l") ?? "u",
      isWeighed: !!p.is_weighed,
      cost: Number(p.cost ?? 0),
      salePrice: Number(p.sale_price ?? 0),
      minStock: Number(p.min_stock ?? 0),
      emoji: p.emoji ?? "",
      barcode: p.barcode ?? "",
      active: !!p.active,
      priceTier: (p.price_tier as ProdRow["priceTier"]) ?? null,
      priceManual: !!p.price_manual,
      category: (p.categories as unknown as { name: string } | null)?.name ?? "",
      stock: invMap.get(p.id) ?? 0,
      pending: pendMap.get(p.id) ?? 0,
      dailyEst: soldReal > 0 ? Math.round(soldReal * 100) / 100 : 0,
    };
  });

  const categories: Cat[] = (catsRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  const expiry = ((expRes.data as { items?: ExpiryItem[] } | null)?.items ?? []) as ExpiryItem[];

  return <ProductosClient products={products} categories={categories} branchId={branchId ?? ""} expiry={expiry} />;
}
