"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { registerCobro } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

export type DocRow = {
  id: string; number: string; doc_date: string; due_date: string | null;
  total: number; balance_due: number; settlement: string; vencida: boolean;
};
export type Cliente = {
  partyId: string; name: string; taxId: string; saldo: number; vencido: number;
  ult: string | null; docs: DocRow[];
};

const fmtDate = (d: string | null) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "—");
const initials = (n: string) => n.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
const COLORS = ["#0F766E", "#B7791F", "#157F52", "#2C6FB5", "#C0392B"];

export default function CuentasClient({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selId, setSelId] = useState(clientes[0]?.partyId ?? "");
  const [amount, setAmount] = useState("");
  const [instrument, setInstrument] = useState<"efectivo" | "transferencia" | "cheque_tercero" | "tarjeta">("transferencia");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sel = clientes.find((c) => c.partyId === selId) ?? clientes[0];
  const totalCobrar = clientes.reduce((s, c) => s + c.saldo, 0);
  const totalVencido = clientes.reduce((s, c) => s + c.vencido, 0);
  const nVenc = clientes.filter((c) => c.vencido > 0).length;

  function cobrar() {
    if (!sel) return;
    const amt = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
    if (amt <= 0) { setMsg({ ok: false, text: "Ingresá un importe válido." }); return; }
    setMsg(null);
    startTransition(async () => {
      const res = await registerCobro({ partyId: sel.partyId, amount: amt, instrument });
      if (res.ok) {
        const extra = res.credit ? ` · saldo a favor ${money(res.credit)}` : "";
        setMsg({ ok: true, text: `Cobro aplicado ${money(res.applied ?? 0)} (FIFO)${extra}.` });
        setAmount("");
      } else {
        setMsg({ ok: false, text: res.error ?? "No se pudo registrar el cobro." });
      }
      router.refresh();
    });
  }

  return (
    <>
      <Topbar title="Cuentas corrientes" subtitle="Clientes con crédito" />
      <div className="cx-view">
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="card kpi"><div className="kpi-l">Total por cobrar</div><div className="kpi-v">{money(totalCobrar)}</div></div>
          <div className="card kpi"><div className="kpi-l">Vencido</div><div className="kpi-v" style={{ color: "var(--red)" }}>{money(totalVencido)}</div><div className="kpi-d">{nVenc} clientes</div></div>
          <div className="card kpi"><div className="kpi-l">Clientes con cuenta</div><div className="kpi-v">{clientes.length}</div></div>
        </div>

        <div className="split" style={{ marginTop: 15, gridTemplateColumns: "300px 1fr" }}>
          <div className="card" style={{ alignSelf: "start" }}>
            <div className="cx-panel-h"><h3>Clientes</h3></div>
            {clientes.map((c, i) => (
              <button key={c.partyId} onClick={() => { setSelId(c.partyId); setMsg(null); }} className="prov-item" style={c.partyId === selId ? { background: "var(--acc-soft)" } : undefined}>
                <span className="avat" style={{ background: COLORS[i % COLORS.length] }}>{initials(c.name)}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)" }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{c.taxId}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="tnum" style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>{money(c.saldo)}</div>
                  {c.vencido > 0 && <span className="pill pill-bad" style={{ marginTop: 3 }}>vencido</span>}
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
                  <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 10 }}>Saldo</div><div className="tnum" style={{ fontSize: 17, fontWeight: 700, color: sel.saldo > 0 ? "var(--ink-2)" : "var(--green)" }}>{money(sel.saldo)}</div></div>
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
                            <td className="num tnum" style={{ color: d.balance_due > 0 ? "var(--ink-2)" : "var(--green)", fontWeight: 600 }}>{money(d.balance_due)}</td>
                            <td><span className={"pill " + est[0]}>{est[1]}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card card-pad">
                <h3 style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>Registrar cobro</h3>
                <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>Se aplica automáticamente a las facturas más antiguas (FIFO). El excedente queda como saldo a favor.</p>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className="field" style={{ width: 160 }}>
                    <label>Importe</label>
                    <div className="in-field"><span>$</span><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" /></div>
                  </div>
                  <div className="field" style={{ width: 180 }}>
                    <label>Instrumento</label>
                    <select className="inp" value={instrument} onChange={(e) => setInstrument(e.target.value as typeof instrument)}>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="cheque_tercero">Cheque de tercero</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={cobrar} disabled={pending}>
                    <Icon name="check" size={15} /> {pending ? "Aplicando…" : "Registrar cobro"}
                  </button>
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
      </div>
    </>
  );
}
