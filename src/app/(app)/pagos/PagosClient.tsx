"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { registrarPago } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "—");
const initials = (n: string) => n.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
const COLORS = ["#0F766E", "#B7791F", "#C0392B", "#157F52", "#2C6FB5"];

type Doc = { id: string; number: string; doc_date: string; due_date: string | null; total: number; balance_due: number; settlement: string; vencida: boolean };
export type Prov = { partyId: string; name: string; taxId: string; saldo: number; vencido: number; docs: Doc[] };
export type ChequePropio = { id: string; number: string; bank: string; issueDate: string | null; dueDate: string | null; status: string; amount: number; beneficiario: string; vencido: boolean };

export default function PagosClient({ proveedores, chequesPropios }: { proveedores: Prov[]; chequesPropios: ChequePropio[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"cc" | "cheq">("cc");
  const [selId, setSelId] = useState(proveedores[0]?.partyId ?? "");
  const [amount, setAmount] = useState("");
  const [instrument, setInstrument] = useState<"transferencia" | "efectivo" | "cheque_propio" | "retencion" | "caja_grande">("transferencia");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sel = proveedores.find((p) => p.partyId === selId) ?? proveedores[0];
  const totalPagar = proveedores.reduce((s, p) => s + p.saldo, 0);
  const totalVencido = proveedores.reduce((s, p) => s + p.vencido, 0);
  const totalChq = chequesPropios.reduce((s, c) => s + c.amount, 0);

  function pagar() {
    if (!sel) return;
    const amt = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
    if (amt <= 0) { setMsg({ ok: false, text: "Ingresá un importe válido." }); return; }
    setMsg(null);
    startTransition(async () => {
      const res = await registrarPago({ partyId: sel.partyId, amount: amt, instrument });
      if (res.ok) {
        const extra = res.credit ? ` · a favor ${money(res.credit)}` : "";
        setMsg({ ok: true, text: `Pago aplicado ${money(res.applied ?? 0)} (FIFO)${extra}.` });
        setAmount("");
      } else setMsg({ ok: false, text: res.error ?? "No se pudo registrar el pago." });
      router.refresh();
    });
  }

  return (
    <>
      <Topbar title="A pagar" subtitle="Obligaciones con proveedores" />
      <div className="cx-view">
        <div className="kpi-grid">
          <div className="card kpi"><div className="kpi-l">Total a pagar (cta cte)</div><div className="kpi-v">{money(totalPagar)}</div></div>
          <div className="card kpi"><div className="kpi-l">Vencido</div><div className="kpi-v" style={{ color: "var(--red)" }}>{money(totalVencido)}</div></div>
          <div className="card kpi"><div className="kpi-l">Cheques propios</div><div className="kpi-v" style={{ color: "var(--amber)" }}>{money(totalChq)}</div><div className="kpi-d">{chequesPropios.length} emitidos</div></div>
          <div className="card kpi"><div className="kpi-l">Proveedores con saldo</div><div className="kpi-v">{proveedores.filter((p) => p.saldo > 0).length}</div></div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 2px 12px", flexWrap: "wrap" }}>
          <div className="seg">
            <button className={tab === "cc" ? "on" : ""} onClick={() => setTab("cc")}>Cta. cte. proveedores</button>
            <button className={tab === "cheq" ? "on" : ""} onClick={() => setTab("cheq")}>Cheques propios</button>
          </div>
        </div>

        {tab === "cc" ? (
          <div className="split" style={{ gridTemplateColumns: "300px 1fr" }}>
            <div className="card" style={{ alignSelf: "start" }}>
              <div className="cx-panel-h"><h3>Proveedores</h3></div>
              {proveedores.map((p, i) => (
                <button key={p.partyId} onClick={() => { setSelId(p.partyId); setMsg(null); }} className="prov-item" style={p.partyId === selId ? { background: "var(--acc-soft)" } : undefined}>
                  <span className="avat" style={{ background: COLORS[i % COLORS.length] }}>{initials(p.name)}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)" }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{p.taxId}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tnum" style={{ fontSize: 12, color: "var(--red)", fontWeight: 600 }}>{money(p.saldo)}</div>
                    {p.vencido > 0 && <span className="pill pill-bad" style={{ marginTop: 3 }}>vencido</span>}
                  </div>
                </button>
              ))}
            </div>
            {sel && (
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div className="card">
                  <div className="cx-panel-h" style={{ gap: 12 }}>
                    <h3 style={{ textTransform: "none", letterSpacing: "normal", fontSize: 15, color: "var(--ink-2)" }}>{sel.name}</h3>
                    <span className="muted" style={{ fontSize: 11 }}>CUIT {sel.taxId}</span>
                    <div style={{ flex: 1 }} />
                    <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 10 }}>Saldo a pagar</div><div className="tnum" style={{ fontSize: 17, fontWeight: 700, color: sel.saldo > 0 ? "var(--red)" : "var(--green)" }}>{money(sel.saldo)}</div></div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="tbl">
                      <thead><tr><th>Comprobante</th><th>Fecha</th><th>Vto.</th><th className="num">Total</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
                      <tbody>
                        {sel.docs.length === 0 ? (
                          <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 22 }}>Sin comprobantes</td></tr>
                        ) : sel.docs.map((d) => {
                          const est = d.settlement === "pagado" ? ["pill-ok", "Pagado"] : d.vencida ? ["pill-bad", "Vencido"] : d.settlement === "parcial" ? ["pill-warn", "Parcial"] : ["pill-warn", "Pendiente"];
                          return (
                            <tr key={d.id}>
                              <td><b style={{ color: "var(--ink-2)" }}>{d.number}</b></td>
                              <td className="tnum">{fmtDate(d.doc_date)}</td>
                              <td className="tnum">{fmtDate(d.due_date)}</td>
                              <td className="num tnum">{money(d.total)}</td>
                              <td className="num tnum" style={{ color: d.balance_due > 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{money(d.balance_due)}</td>
                              <td><span className={"pill " + est[0]}>{est[1]}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card card-pad">
                  <h3 style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>Registrar pago</h3>
                  <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>Se aplica a las facturas más antiguas (FIFO).</p>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div className="field" style={{ width: 160 }}><label>Importe</label><div className="in-field"><span>$</span><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" /></div></div>
                    <div className="field" style={{ width: 180 }}><label>Instrumento</label>
                      <select className="inp" value={instrument} onChange={(e) => setInstrument(e.target.value as typeof instrument)}>
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo (caja)</option>
                        <option value="caja_grande">Tesorería</option>
                        <option value="cheque_propio">Cheque propio</option>
                        <option value="retencion">Retención</option>
                      </select>
                    </div>
                    <button className="btn btn-primary" onClick={pagar} disabled={pending}><Icon name="wallet" size={15} /> {pending ? "Aplicando…" : "Registrar pago"}</button>
                  </div>
                  {msg && (
                    <div className="note" style={{ marginTop: 14, ...(msg.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
                      <Icon name="check" size={16} /><span>{msg.text}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Nº cheque</th><th>Banco</th><th>Beneficiario</th><th>Emisión</th><th>Pago diferido</th><th className="num">Importe</th></tr></thead>
              <tbody>
                {chequesPropios.length === 0 ? (
                  <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 22 }}>Sin cheques propios emitidos</td></tr>
                ) : chequesPropios.map((c) => (
                  <tr key={c.id}>
                    <td className="tnum"><b style={{ color: "var(--ink-2)" }}>{c.number}</b></td>
                    <td>{c.bank}</td>
                    <td>{c.beneficiario}</td>
                    <td className="tnum">{fmtDate(c.issueDate)}</td>
                    <td><span className={"pill " + (c.vencido ? "pill-bad" : "pill-warn")}>{fmtDate(c.dueDate)}</span></td>
                    <td className="num tnum">{money(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
