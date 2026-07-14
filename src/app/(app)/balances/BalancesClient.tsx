"use client";

import { useState, useTransition } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";
import { closePeriod } from "./actions";

export type Kpis = {
  ok: boolean;
  revenue?: number; cogs?: number; contribution?: number; contribution_margin_pct?: number;
  gross_result?: number; operating_result?: number;
  fixed_costs?: number; days?: number; burn_rate_daily?: number; breakeven_revenue?: number | null;
  inventory_value?: number; inventory_days?: number | null;
};
export type ProductMargin = { id: string; name: string; sale_price: number; cost: number; margin: number; margin_pct: number };
export type Irregularities = {
  ok: boolean; day?: string;
  ventas_fuera_horario?: number; cobros_fuera_horario?: number;
  ajustes_grandes?: { product_id: string; name: string; qty_change: number; ratio: number }[];
  nota_precios?: string;
};
export type Rotation = {
  id: string; name: string; units_sold: number; on_hand: number; capital: number;
  turns: number | null; days_cover: number | null;
};
export type PriceVar = {
  name: string; last_cost: number; prev_cost: number; variation: number; last_at: string;
};

const pct = (n?: number) => (n === undefined || n === null ? "—" : (n * 100).toFixed(1) + "%");

export default function BalancesClient({
  kpis, margins, irr, rotation, priceVars, closedThrough, canClose, periodLabel, suggestedClose,
}: {
  kpis: Kpis; margins: ProductMargin[]; irr: Irregularities;
  rotation: Rotation[]; priceVars: PriceVar[];
  closedThrough: string | null; canClose: boolean; periodLabel: string; suggestedClose: string;
}) {
  const [closed, setClosed] = useState(closedThrough);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  function cerrar() {
    start(async () => {
      const res = await closePeriod(suggestedClose);
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo cerrar." }); return; }
      setClosed(res.closedThrough ?? suggestedClose);
      setFlash({ ok: true, text: `Período cerrado hasta ${res.closedThrough}. No se admiten asientos con esa fecha o anteriores.` });
    });
  }

  if (!kpis.ok) {
    return (
      <>
        <Topbar title="Balances" subtitle="Análisis financiero" />
        <div className="cx-view">
          <div className="card card-pad"><div className="muted">No tenés permiso para ver el análisis financiero.</div></div>
        </div>
      </>
    );
  }

  const irrCount = (irr.ventas_fuera_horario ?? 0) + (irr.cobros_fuera_horario ?? 0) + (irr.ajustes_grandes?.length ?? 0);
  const worst = margins.slice(0, 12);

  const stagnant = rotation.filter((r) => r.days_cover === null && r.on_hand > 0);
  const stagnantCapital = stagnant.reduce((s, r) => s + r.capital, 0);
  const rotWorst = rotation.slice(0, 12);
  const varWorst = priceVars.slice(0, 10);

  return (
    <>
      <Topbar title="Balances" subtitle="Análisis financiero · en vivo" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <span className="pill pill-plain" style={{ textTransform: "capitalize" }}>{periodLabel}</span>
          <span className="muted" style={{ fontSize: 12 }}>calculado del libro mayor · {kpis.days} días</span>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 12 }}>
            {closed ? <>Período cerrado hasta <b style={{ color: "var(--ink-2)" }}>{closed}</b></> : "Sin cierre de período"}
          </span>
          {canClose && (
            <button className="btn" onClick={cerrar} disabled={busy} title={`Cierra los asientos hasta ${suggestedClose}`}>
              <Icon name="check" size={15} /> {busy ? "Cerrando…" : "Cerrar mes anterior"}
            </button>
          )}
        </div>

        {flash && (
          <div className="note" style={{ marginBottom: 12, ...(flash.ok
            ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" }
            : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
            <Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span>
          </div>
        )}

        {/* KPIs de supervivencia */}
        <div className="kpi-grid">
          <div className="card kpi"><div className="kpi-l">Ventas del mes</div><div className="kpi-v" style={{ color: "var(--green)" }}>{money(kpis.revenue ?? 0)}</div><div className="kpi-d muted">costo {money(kpis.cogs ?? 0)}</div></div>
          <div className="card kpi"><div className="kpi-l">Margen de contribución</div><div className="kpi-v">{money(kpis.contribution ?? 0)}</div><div className="kpi-d" style={{ color: "var(--acc)" }}>{pct(kpis.contribution_margin_pct)}</div></div>
          <div className="card kpi"><div className="kpi-l">Burn rate diario</div><div className="kpi-v" style={{ color: "var(--red)" }}>{money(kpis.burn_rate_daily ?? 0)}</div><div className="kpi-d muted">costos fijos {money(kpis.fixed_costs ?? 0)}</div></div>
          <div className="card kpi"><div className="kpi-l">Punto de equilibrio</div><div className="kpi-v">{kpis.breakeven_revenue ? money(kpis.breakeven_revenue) : "—"}</div><div className="kpi-d muted">ventas para cubrir estructura</div></div>
          <div className="card kpi"><div className="kpi-l">Inventario valorizado</div><div className="kpi-v" style={{ color: "var(--cyan)" }}>{money(kpis.inventory_value ?? 0)}</div><div className="kpi-d muted">capital inmovilizado{kpis.inventory_days ? ` · ${kpis.inventory_days} días de venta` : ""}</div></div>
        </div>

        {/* Estado de resultados del período (real, a costo FIFO) */}
        <div className="card" style={{ marginTop: 15 }}>
          <div className="cx-panel-h"><h3>Estado de resultados</h3><span className="muted" style={{ fontSize: 11 }}>costo real FIFO · {periodLabel}</span></div>
          <div style={{ padding: "6px 18px 16px", maxWidth: 520 }}>
            {[
              { l: "Ventas netas", v: kpis.revenue ?? 0, sign: 1, strong: false },
              { l: "Costo de mercadería vendida (CMV)", v: -(kpis.cogs ?? 0), sign: -1, strong: false },
            ].map((r) => (
              <div key={r.l} className="tot" style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5 }}>
                <span className="muted">{r.l}</span>
                <span className="tnum" style={{ color: r.sign < 0 ? "var(--red)" : "var(--ink-2)" }}>{money(r.v)}</span>
              </div>
            ))}
            <div className="tot" style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line)", fontWeight: 600 }}>
              <span>Resultado bruto</span>
              <span className="tnum" style={{ color: "var(--green)" }}>{money(kpis.gross_result ?? 0)} <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>({pct(kpis.contribution_margin_pct)})</span></span>
            </div>
            <div className="tot" style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5 }}>
              <span className="muted">Costos fijos (servicios y gastos)</span>
              <span className="tnum" style={{ color: "var(--red)" }}>{money(-(kpis.fixed_costs ?? 0))}</span>
            </div>
            <div className="tot grand" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 2px", borderTop: "2px solid var(--line)", fontWeight: 700, fontSize: 15 }}>
              <span>Resultado operativo</span>
              <span className="tnum" style={{ color: (kpis.operating_result ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>{money(kpis.operating_result ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="split" style={{ marginTop: 15 }}>
          {/* Margen por producto */}
          <div className="card" style={{ overflowX: "auto" }}>
            <div className="cx-panel-h"><h3>Margen de contribución por producto</h3><span className="muted" style={{ fontSize: 11 }}>peor primero</span></div>
            <table className="tbl">
              <thead><tr><th>Producto</th><th className="num">Precio</th><th className="num">Costo</th><th className="num">Margen</th><th className="num">%</th></tr></thead>
              <tbody>
                {worst.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 18 }}>Sin productos cargados.</td></tr>
                ) : worst.map((m) => {
                  const bad = m.margin <= 0;
                  return (
                    <tr key={m.id}>
                      <td style={{ color: "var(--ink-2)" }}>{m.name}</td>
                      <td className="num tnum">{money(m.sale_price)}</td>
                      <td className="num tnum muted">{money(m.cost)}</td>
                      <td className="num tnum" style={{ color: bad ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{money(m.margin)}</td>
                      <td className="num"><span className={"pill " + (bad ? "pill-bad" : m.margin_pct < 0.15 ? "pill-warn" : "pill-ok")}>{pct(m.margin_pct)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Irregularidades del día */}
          <div className="card">
            <div className="cx-panel-h">
              <h3>Auditoría del día</h3>
              <span className={"pill " + (irrCount > 0 ? "pill-warn" : "pill-ok")} style={{ fontSize: 10 }}>{irrCount > 0 ? `${irrCount} a revisar` : "sin novedades"}</span>
            </div>
            <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span className="muted">Ventas fuera de horario</span>
                <span className="tnum" style={{ color: (irr.ventas_fuera_horario ?? 0) > 0 ? "var(--amber)" : "var(--dim)" }}>{irr.ventas_fuera_horario ?? 0}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span className="muted">Cobros fuera de horario</span>
                <span className="tnum" style={{ color: (irr.cobros_fuera_horario ?? 0) > 0 ? "var(--amber)" : "var(--dim)" }}>{irr.cobros_fuera_horario ?? 0}</span>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span className="muted">Ajustes de stock grandes</span>
                  <span className="tnum" style={{ color: (irr.ajustes_grandes?.length ?? 0) > 0 ? "var(--red)" : "var(--dim)" }}>{irr.ajustes_grandes?.length ?? 0}</span>
                </div>
                {(irr.ajustes_grandes ?? []).map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderTop: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--ink-2)" }}>{a.name}</span>
                    <span className="tnum" style={{ color: "var(--red)" }}>{a.qty_change} ({(a.ratio * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <Icon name="check" size={13} /> {irr.nota_precios}
              </div>
            </div>
          </div>
        </div>

        <div className="split" style={{ marginTop: 15 }}>
          {/* Rotación de mercadería */}
          <div className="card" style={{ overflowX: "auto" }}>
            <div className="cx-panel-h">
              <h3>Rotación de mercadería</h3>
              {stagnant.length > 0 ? (
                <span className="pill pill-warn" style={{ fontSize: 10 }}>
                  {money(stagnantCapital)} sin rotar
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 11 }}>menos rotación primero</span>
              )}
            </div>
            <table className="tbl">
              <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Vendido</th><th className="num">Capital</th><th className="num">Cobertura</th></tr></thead>
              <tbody>
                {rotWorst.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 18 }}>Sin movimientos de stock.</td></tr>
                ) : rotWorst.map((r) => {
                  const dead = r.days_cover === null;
                  const slow = r.days_cover !== null && r.days_cover > 90;
                  return (
                    <tr key={r.id}>
                      <td style={{ color: "var(--ink-2)" }}>{r.name}</td>
                      <td className="num tnum muted">{r.on_hand}</td>
                      <td className="num tnum muted">{r.units_sold}</td>
                      <td className="num tnum" style={{ color: dead ? "var(--red)" : "var(--ink-2)", fontWeight: dead ? 600 : 400 }}>{money(r.capital)}</td>
                      <td className="num">
                        <span className={"pill " + (dead ? "pill-bad" : slow ? "pill-warn" : "pill-ok")}>
                          {dead ? "no rota" : `${r.days_cover} días`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 11, padding: "2px 16px 14px" }}>
              <Icon name="alert" size={13} /> “No rota” = tiene stock pero no registró ventas en el período: capital inmovilizado.
            </div>
          </div>

          {/* Variación de precios de proveedor */}
          <div className="card" style={{ overflowX: "auto" }}>
            <div className="cx-panel-h">
              <h3>Variación de precios de proveedor</h3>
              <span className="muted" style={{ fontSize: 11 }}>última compra vs anterior</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Producto</th><th className="num">Costo anterior</th><th className="num">Costo actual</th><th className="num">Variación</th></tr></thead>
              <tbody>
                {varWorst.length === 0 ? (
                  <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 18 }}>Aún no hay dos compras del mismo producto para comparar.</td></tr>
                ) : varWorst.map((v, i) => {
                  const up = v.variation > 0;
                  const strong = Math.abs(v.variation) >= 0.1;
                  return (
                    <tr key={i}>
                      <td style={{ color: "var(--ink-2)" }}>{v.name}</td>
                      <td className="num tnum muted">{money(v.prev_cost)}</td>
                      <td className="num tnum">{money(v.last_cost)}</td>
                      <td className="num">
                        <span className={"pill " + (up ? (strong ? "pill-bad" : "pill-warn") : "pill-ok")}>
                          {up ? "▲ " : "▼ "}{pct(Math.abs(v.variation))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 11, padding: "2px 16px 14px" }}>
              <Icon name="check" size={13} /> Un salto ▲ fuerte suele pedir actualizar el precio de venta para no perder margen.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
