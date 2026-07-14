"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { proveedores, money } from "@/lib/seed";

const nf = (n: number) => Math.round(n).toLocaleString("es-AR");

export default function ProveedoresPage() {
  const [mode, setMode] = useState<"prov" | "art">("prov");
  const [sel, setSel] = useState(proveedores[0].id);
  const p = proveedores.find((x) => x.id === sel)!;

  // por producto: agrupar
  const byGen: Record<string, { prov: typeof proveedores[number]; pr: (typeof proveedores)[number]["prods"][number] }[]> = {};
  proveedores.forEach((pv) => pv.prods.forEach((pr) => { (byGen[pr.gen] ||= []).push({ prov: pv, pr }); }));

  return (
    <>
      <Topbar title="Proveedores" subtitle="Vinculados a productos" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <div className="seg">
            <button className={mode === "prov" ? "on" : ""} onClick={() => setMode("prov")}>Por proveedor</button>
            <button className={mode === "art" ? "on" : ""} onClick={() => setMode("art")}>Por producto</button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Vínculo bidireccional: un producto puede tener varios proveedores.</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary"><Icon name="factory" size={15} /> Nuevo proveedor</button>
        </div>

        {mode === "prov" ? (
          <div className="split" style={{ gridTemplateColumns: "300px 1fr" }}>
            <div className="card" style={{ alignSelf: "start" }}>
              <div className="cx-panel-h"><h3>Proveedores</h3></div>
              {proveedores.map((pv) => (
                <button key={pv.id} onClick={() => setSel(pv.id)} className="prov-item" style={pv.id === sel ? { background: "var(--acc-soft)" } : undefined}>
                  <span className="avat" style={{ background: pv.color }}>{pv.id}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)" }}>{pv.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{pv.prods.length} productos</div>
                  </div>
                  {pv.saldo > 0 ? <span className="tnum" style={{ color: "var(--red)", fontSize: 12 }}>{money(pv.saldo)}</span> : <span className="pill pill-ok">Al día</span>}
                </button>
              ))}
            </div>
            <div className="card">
              <div className="cx-panel-h" style={{ gap: 12 }}>
                <span className="avat" style={{ background: p.color, width: 40, height: 40, fontSize: 15 }}>{p.id}</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ textTransform: "none", letterSpacing: "normal", fontSize: 15, color: "var(--ink-2)" }}>{p.name}</h3>
                  <div className="muted" style={{ fontSize: 11 }}>CUIT {p.cuit}</div>
                </div>
                {p.saldo > 0 ? <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 10 }}>Saldo a pagar</div><div className="tnum" style={{ color: "var(--red)", fontSize: 17, fontWeight: 600 }}>{money(p.saldo)}</div></div> : <span className="pill pill-ok">Sin deuda</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--line)" }}>
                <div style={{ background: "var(--panel-2)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 11 }}>Teléfono</div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)" }}>{p.tel}</div></div>
                <div style={{ background: "var(--panel-2)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 11 }}>Dirección</div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)" }}>{p.dir}</div></div>
                <div style={{ background: "var(--panel-2)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 11 }}>Condición de pago</div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)" }}>{p.pago}</div></div>
              </div>
              <div className="cx-panel-h" style={{ borderTop: "1px solid var(--line)" }}><h3>Productos que provee</h3><span className="muted" style={{ fontSize: 11 }}>{p.prods.length} vinculados</span></div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead><tr><th>Producto genérico</th><th>Marca / presentación</th><th>Código</th><th className="num">Último costo</th></tr></thead>
                  <tbody>
                    {p.prods.map((pr, i) => (
                      <tr key={i}><td><span className="pill pill-plain">{pr.gen}</span></td><td style={{ fontWeight: 500, color: "var(--ink-2)" }}>{pr.marca}</td><td className="tnum muted">{pr.cod}</td><td className="num tnum">$ {nf(pr.costo)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="cx-panel-h"><h3>Productos genéricos y sus proveedores</h3><span className="muted" style={{ fontSize: 11 }}>Se marca el mejor costo</span></div>
            {Object.keys(byGen).map((gen) => {
              const offers = [...byGen[gen]].sort((a, b) => a.pr.costo - b.pr.costo);
              const best = offers[0].pr.costo;
              return (
                <div key={gen} style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span className="pill pill-plain">{gen}</span><span className="muted" style={{ fontSize: 11 }}>{offers.length} proveedor(es)</span>
                  </div>
                  <div style={{ display: "grid", gap: 7 }}>
                    {offers.map((o, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13 }}>
                        <span className="avat" style={{ background: o.prov.color, width: 24, height: 24, fontSize: 10 }}>{o.prov.id}</span>
                        <span style={{ fontWeight: 500, width: 170, color: "var(--ink-2)" }}>{o.prov.name}</span>
                        <span className="muted" style={{ flex: 1 }}>{o.pr.marca}</span>
                        <span className="tnum" style={{ fontWeight: 600, color: "var(--ink-2)" }}>$ {nf(o.pr.costo)}</span>
                        {o.pr.costo === best ? <span className="pill pill-ok">Mejor costo</span> : <span style={{ width: 82 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
