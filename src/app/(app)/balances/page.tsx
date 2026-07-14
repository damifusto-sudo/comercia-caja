import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BalancesClient, {
  type Kpis, type ProductMargin, type Irregularities, type Rotation, type PriceVar,
} from "./BalancesClient";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function BalancesPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // último día del mes anterior
  const fromStr = iso(from);
  const today = iso(now);

  const [kpiRes, marginRes, irrRes, rotRes, varRes, lockRes] = await Promise.all([
    supabase.rpc("financial_kpis", { p_org: ctx.orgId, p_from: fromStr, p_to: today }),
    supabase.rpc("product_margins", { p_org: ctx.orgId, p_limit: 60 }),
    supabase.rpc("irregularity_report", { p_org: ctx.orgId, p_day: today }),
    supabase.rpc("inventory_rotation", { p_org: ctx.orgId, p_from: fromStr, p_to: today, p_limit: 60 }),
    supabase.rpc("supplier_price_variation", { p_org: ctx.orgId, p_limit: 40 }),
    supabase.from("period_locks").select("closed_through").eq("org_id", ctx.orgId).maybeSingle(),
  ]);

  const kpis = (kpiRes.data ?? { ok: false }) as Kpis;
  const margins = ((marginRes.data as { items?: ProductMargin[] } | null)?.items ?? []) as ProductMargin[];
  const irr = (irrRes.data ?? { ok: false }) as Irregularities;
  const rotation = ((rotRes.data as { items?: Rotation[] } | null)?.items ?? []) as Rotation[];
  const priceVars = ((varRes.data as { items?: PriceVar[] } | null)?.items ?? []) as PriceVar[];

  return (
    <BalancesClient
      kpis={kpis}
      margins={margins}
      irr={irr}
      rotation={rotation}
      priceVars={priceVars}
      closedThrough={(lockRes.data as { closed_through?: string } | null)?.closed_through ?? null}
      canClose={ctx.role === "owner" || ctx.role === "admin"}
      periodLabel={from.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
      suggestedClose={iso(prevMonthEnd)}
    />
  );
}
