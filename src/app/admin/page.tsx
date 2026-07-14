import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLANS, money } from "../suscripcion/plans";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  trial: { label: "Prueba", cls: "pill-plain" },
  active: { label: "Activa", cls: "pill-ok" },
  past_due: { label: "Pago pendiente", cls: "pill-warn" },
  canceled: { label: "Cancelada", cls: "pill-bad" },
};
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-AR") : "—");

export default async function AdminPage() {
  const ctx = await requireContext();
  if (!ctx.isSuperadmin) redirect("/panel");

  const supabase = await createClient();
  const [{ data: orgs }, { data: subs }] = await Promise.all([
    supabase.from("organizations").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("org_id, plan, status, trial_ends_at, current_period_end"),
  ]);

  const subByOrg = new Map((subs ?? []).map((s) => [s.org_id, s]));
  const rows = (orgs ?? []).map((o) => ({ ...o, sub: subByOrg.get(o.id) }));

  const total = rows.length;
  const activos = rows.filter((r) => r.sub?.status === "active").length;
  const enTrial = rows.filter((r) => r.sub?.status === "trial").length;
  const mrr = rows.reduce((s, r) => s + (r.sub?.status === "active" ? PLANS[r.sub.plan]?.amount ?? 0 : 0), 0);

  return (
    <main style={{ minHeight: "100vh", padding: "24px 28px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(150deg,var(--acc),#1f66b8)", color: "#022", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}>C</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ink-2)" }}>Panel del proveedor</div>
            <div className="muted" style={{ fontSize: 12 }}>Todos los comercios y sus suscripciones</div>
          </div>
          <Link className="btn" href="/panel">Volver a mi comercio</Link>
        </div>

        <div className="kpi-grid">
          <div className="card kpi"><div className="kpi-l">Comercios</div><div className="kpi-v">{total}</div></div>
          <div className="card kpi"><div className="kpi-l">Suscripciones activas</div><div className="kpi-v" style={{ color: "var(--green)" }}>{activos}</div></div>
          <div className="card kpi"><div className="kpi-l">En prueba</div><div className="kpi-v" style={{ color: "var(--cyan)" }}>{enTrial}</div></div>
          <div className="card kpi"><div className="kpi-l">Ingreso mensual (MRR)</div><div className="kpi-v" style={{ color: "var(--acc)" }}>{money(mrr)}</div></div>
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Comercio</th><th>Alta</th><th>Plan</th><th>Estado</th><th>Trial hasta</th><th>Próx. cobro</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 22 }}>Sin comercios todavía.</td></tr>
              ) : rows.map((r) => {
                const st = r.sub ? STATUS[r.sub.status] ?? STATUS.trial : { label: "Sin suscripción", cls: "pill-mute" };
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: "var(--ink-2)" }}>{r.name}</td>
                    <td className="muted tnum">{fmtDate(r.created_at)}</td>
                    <td>{r.sub ? (PLANS[r.sub.plan]?.label ?? r.sub.plan) : "—"}</td>
                    <td><span className={"pill " + st.cls}>{st.label}</span></td>
                    <td className="muted tnum">{fmtDate(r.sub?.trial_ends_at ?? null)}</td>
                    <td className="muted tnum">{fmtDate(r.sub?.current_period_end ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
