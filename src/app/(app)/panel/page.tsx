import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PanelLive, { type Venc } from "./PanelLive";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // Consultas independientes → en paralelo (una sola espera de red)
  const branchQ = supabase.from("branches").select("name");
  const [branchRes, orgRes, vencRes, kpiRes] = await Promise.all([
    ctx.branchId
      ? branchQ.eq("id", ctx.branchId).maybeSingle()
      : branchQ.eq("org_id", ctx.orgId).order("created_at").limit(1).maybeSingle(),
    supabase.from("organizations").select("daily_target").eq("id", ctx.orgId).maybeSingle(),
    supabase
      .from("documents")
      .select("id, number, due_date, balance_due, category, parties(name, kind)")
      .eq("org_id", ctx.orgId)
      .eq("kind", "factura")
      .eq("status", "aprobado")
      .gt("balance_due", 0.5)
      .not("due_date", "is", null)
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd)
      .order("due_date"),
    // Margen de ganancia de HOY (real, del libro mayor): Ventas netas − Costo (CMV)
    supabase.rpc("financial_kpis", { p_org: ctx.orgId, p_from: today, p_to: today }),
  ]);

  const sucursal = branchRes.data?.name ?? "Centro";
  const objetivo = Number(orgRes.data?.daily_target ?? 400000);
  const vencRaw = vencRes.data;

  const k = (kpiRes.data ?? {}) as { revenue?: number; cogs?: number; contribution?: number; contribution_margin_pct?: number };
  const margenHoy = {
    ventas: Number(k.revenue ?? 0),
    costo: Number(k.cogs ?? 0),
    margen: Number(k.contribution ?? 0),
    pct: Number(k.contribution_margin_pct ?? 0),
  };

  const vencimientos: Venc[] = (vencRaw ?? []).map((d) => {
    const p = (Array.isArray(d.parties) ? d.parties[0] : d.parties) as { name?: string; kind?: string } | null;
    const cat = (d.category ?? "") as string;
    const esPago = p?.kind === "proveedor" || (p?.kind === "ambos" && /^(compra|servicio)/.test(cat));
    return {
      id: d.id,
      number: d.number ?? "—",
      party: p?.name ?? "—",
      due: d.due_date as string,
      amount: Number(d.balance_due),
      tipo: esPago ? "pagar" : "cobrar",
    };
  });

  return (
    <PanelLive
      orgName={ctx.orgName}
      sucursal={sucursal}
      operator={ctx.fullName || ctx.email}
      objetivo={objetivo}
      canEdit={ctx.role !== "cajero"}
      vencimientos={vencimientos}
      margenHoy={margenHoy}
    />
  );
}
