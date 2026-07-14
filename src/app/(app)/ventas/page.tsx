import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import VentasPOS, { type ClienteLite, type PosItem, type QrWallet, type PayAccount } from "./VentasPOS";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const ctx = await requireContext();
  // El cajero opera todo desde su caja (ventas integradas). /ventas queda para admin.
  if (ctx.role === "cajero") redirect("/caja");
  const supabase = await createClient();

  // Sucursal de trabajo: la del cajero o la primera de la org
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

  const { data: prods } = await supabase
    .from("products")
    .select("id, name, emoji, base_unit, is_weighed, sale_price, categories(name)")
    .eq("active", true)
    .order("name");

  const products: PosItem[] = (prods ?? []).map((p) => {
    const cat = p.categories as unknown as { name: string } | null;
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji ?? "📦",
      cat: cat?.name ?? "Otros",
      weighed: !!p.is_weighed,
      price: Number(p.sale_price ?? 0),
    };
  });

  const { data } = await supabase
    .from("parties")
    .select("id, name")
    .in("kind", ["cliente", "ambos"])
    .order("name");
  const clientes: ClienteLite[] = (data ?? []).map((c) => ({ id: c.id, name: c.name }));

  // Medios de cobro de la org (banco, billetera, tarjeta…): cada uno con su
  // comisión (fee_rate). El POS los usa para acreditar tarjeta/QR y descontar el
  // costo financiero — así el flujo de caja NETO refleja lo que realmente entra.
  const { data: finData } = await supabase
    .from("fin_accounts")
    .select("id, name, qr, fee_rate")
    .eq("org_id", ctx.orgId)
    .eq("collect", true)
    .eq("active", true)
    .order("name");

  const payAccounts: PayAccount[] = (finData ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    feeRate: Number(a.fee_rate ?? 0),
  }));
  const qrWallets: QrWallet[] = (finData ?? [])
    .filter((w) => w.qr)
    .map((w) => ({ id: w.id, name: w.name, qr: w.qr as string, feeRate: Number(w.fee_rate ?? 0) }));

  return (
    <VentasPOS
      clientes={clientes}
      products={products}
      branchId={branchId ?? ""}
      qrWallets={qrWallets}
      cardAccounts={payAccounts}
    />
  );
}
