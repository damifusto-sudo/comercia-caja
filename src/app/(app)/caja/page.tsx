import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CajaClient, { type CajaSaldoRow } from "./CajaClient";
import type { ClienteLite, PosItem, QrWallet, PayAccount } from "../ventas/VentasPOS";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Sucursal de trabajo: la del cajero o la primera de la org
  let branchId = ctx.branchId;
  if (!branchId) {
    const { data: b } = await supabase
      .from("branches").select("id").eq("org_id", ctx.orgId).order("created_at").limit(1).maybeSingle();
    branchId = b?.id ?? null;
  }

  // Identidad de la caja del operador (individual: solo la suya)
  let cajaName = "Caja principal";
  if (ctx.cajaId) {
    const { data: cr } = await supabase.from("cash_registers").select("name").eq("id", ctx.cajaId).maybeSingle();
    if (cr?.name) cajaName = cr.name;
  }

  const { data: prods } = await supabase
    .from("products")
    .select("id, name, emoji, base_unit, is_weighed, sale_price, barcode, categories(name)")
    .eq("active", true)
    .order("name");

  // Stock disponible por producto en la sucursal
  const { data: inv } = branchId
    ? await supabase.from("inventory").select("product_id, qty").eq("branch_id", branchId)
    : { data: [] as { product_id: string; qty: number }[] };
  const stockMap = new Map((inv ?? []).map((i) => [i.product_id, Number(i.qty)]));

  // Ventas de los últimos 30 días → ranking de más vendidos
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: mov } = branchId
    ? await supabase.from("stock_movements").select("product_id, qty_change").eq("branch_id", branchId).eq("reason", "venta").gte("created_at", since)
    : { data: [] as { product_id: string; qty_change: number }[] };
  const soldMap = new Map<string, number>();
  for (const m of mov ?? []) soldMap.set(m.product_id, (soldMap.get(m.product_id) ?? 0) + Math.abs(Number(m.qty_change)));

  const products: PosItem[] = (prods ?? []).map((p) => {
    const cat = p.categories as unknown as { name: string } | null;
    return {
      id: p.id, name: p.name, emoji: p.emoji ?? "📦", cat: cat?.name ?? "Otros",
      weighed: !!p.is_weighed, price: Number(p.sale_price ?? 0),
      stock: stockMap.get(p.id) ?? 0, sold: soldMap.get(p.id) ?? 0,
      barcode: (p as { barcode?: string | null }).barcode ?? null,
    };
  });

  const { data } = await supabase
    .from("parties").select("id, name").in("kind", ["cliente", "ambos"]).order("name");
  const clientes: ClienteLite[] = (data ?? []).map((c) => ({ id: c.id, name: c.name }));

  // Medios de cobro de la org (con su comisión) para acreditar tarjeta/QR
  const { data: finData } = await supabase
    .from("fin_accounts")
    .select("id, name, qr, fee_rate")
    .eq("org_id", ctx.orgId).eq("collect", true).eq("active", true).order("name");
  const cardAccounts: PayAccount[] = (finData ?? []).map((a) => ({ id: a.id, name: a.name, feeRate: Number(a.fee_rate ?? 0) }));
  const qrWallets: QrWallet[] = (finData ?? [])
    .filter((w) => w.qr)
    .map((w) => ({ id: w.id, name: w.name, qr: w.qr as string, feeRate: Number(w.fee_rate ?? 0) }));

  // Los saldos del día se OCULTAN en la estación de caja (rol cajero): no se
  // consultan ni se envían al navegador del operador; sólo los ve un responsable.
  const showSaldos = ctx.role !== "cajero";
  let saldo: CajaSaldoRow[] = [];
  if (showSaldos) {
    const { data: saldoData } = await supabase.rpc("caja_saldo_today", { p_org: ctx.orgId });
    saldo = (saldoData ?? []) as CajaSaldoRow[];
  }

  return (
    <CajaClient
      clientes={clientes}
      products={products}
      branchId={branchId ?? ""}
      qrWallets={qrWallets}
      cardAccounts={cardAccounts}
      cajaName={cajaName}
      operator={ctx.fullName || ctx.email}
      saldo={saldo}
      showSaldos={showSaldos}
    />
  );
}
