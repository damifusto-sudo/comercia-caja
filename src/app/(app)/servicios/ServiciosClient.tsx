"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { createServiceInvoice, pagarServicio } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const nf = (n: number) => Math.round(n).toLocaleString("es-AR");
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "—");

const SUBS: Record<string, string> = {
  pub: "Servicios públicos", tel: "Telecomunicaciones", sw: "Software y SaaS", arr: "Arrendamientos",
  man: "Mantenimiento", hon: "Honorarios", seg: "Seguros y vigilancia", otros: "Otros",
};

export type ServiceRow = {
  id: string; partyId: string; subaccount: string; provider: string; taxId: string; concept: string;
  docDate: string; dueDate: string | null; total: number; balance: number; settlement: string; vencida: boolean;
};

const emptyForm = { subaccount: "pub", provider: "", taxId: "", concept: "", docDate: "", dueDate: "", gross: "", vatRate: "21", costCenter: "Administración" };

export default function ServiciosClient({ rows }: { rows: ServiceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState<"todos" | "pendiente" | "vencido" | "pagado">("todos");
  const [sub, setSub] = useState("todas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"transferencia" | "efectivo" | "cheque_propio">("transferencia");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const adeudado = rows.filter((r) => r.settlement !== "pagado").reduce((s, r) => s + r.balance, 0);
  const vencido = rows.filter((r) => r.vencida).reduce((s, r) => s + r.balance, 0);
  const pagados = rows.filter((r) => r.settlement === "pagado").length;

  const filtered = rows.filter((r) => {
    if (sub !== "todas" && r.subaccount !== sub) return false;
    if (estado === "pendiente") return r.settlement !== "pagado" && !r.vencida;
    if (estado === "vencido") return r.vencida;
    if (estado === "pagado") return r.settlement === "pagado";
    return true;
  });

  const grossN = parseFloat(form.gross.replace(/\./g, "").replace(",", ".")) || 0;
  const vatN = Math.round(grossN * (parseFloat(form.vatRate) || 0) / 100);
  const totalN = grossN + vatN;

  function guardar() {
    setMsg(null);
    startTransition(async () => {
      const res = await createServiceInvoice({
        subaccount: form.subaccount, provider: form.provider, taxId: form.taxId, concept: form.concept,
        docDate: form.docDate, dueDate: form.dueDate, gross: grossN, vatRate: parseFloat(form.vatRate) || 0, costCenter: form.costCenter,
      });
      if (res.ok) { setMsg({ ok: true, text: `Factura registrada · total ${money(totalN)} · pendiente de pago.` }); setForm(emptyForm); setShowForm(false); }
      else setMsg({ ok: false, text: res.error ?? "No se pudo registrar." });
      router.refresh();
    });
  }

  function confirmarPago(r: ServiceRow) {
    const amt = parseFloat(payAmount.replace(/\./g, "").replace(",", ".")) || r.balance;
    setMsg(null);
    startTransition(async () => {
      const res = await pagarServicio({ partyId: r.partyId, amount: amt, instrument: payMethod });
      if (res.ok) setMsg({ ok: true, text: `Pago aplicado ${money(res.applied ?? amt)} a ${r.provider}.` });
      else setMsg({ ok: false, text: res.error ?? "No se pudo pagar." });
      setPayId(null); setPayAmount("");
      router.refresh();
    });
  }

  return (
    <>
      <Topbar title="Servicios y gastos" subtitle="Facturas por subcuenta" />
      <div className="cx-view">
        <div className="kpi-grid">
          <div className="card kpi"><div className="kpi-l">Adeudado</div><div className="kpi-v">{money(adeudado)}</div></div>
          <div className="card kpi"><div className="kpi-l">Vencido</div><div className="kpi-v" style={{ color: "var(--red)" }}>{money(vencido)}</div></div>
          <div className="card kpi"><div className="kpi-l">Facturas pagadas</div><div className="kpi-v" style={{ color: "var(--green)" }}>{pagados}</div></div>
          <div className="card kpi"><div className="kpi-l">Total facturas</div><div className="kpi-v">{rows.length}</div></div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 2px 12px", flexWrap: "wrap" }}>
          <div className="seg">
            {(["todos", "pendiente", "vencido", "pagado"] as const).map((e) => (
              <button key={e} className={estado === e ? "on" : ""} onClick={() => setEstado(e)} style={{ textTransform: "capitalize" }}>{e}</button>
            ))}
          </div>
          <select className="inp" style={{ width: 190 }} value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="todas">Todas las subcuentas</option>
            {Object.entries(SUBS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setMsg(null); }}>
            <Icon name="receipt" size={15} /> Nuevo asiento
          </button>
        </div>

        {msg && (
          <div className="note" style={{ marginBottom: 12, ...(msg.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
            <Icon name="check" size={16} /><span>{msg.text}</span>
          </div>
        )}

        {showForm && (
          <div className="card card-pad" style={{ marginBottom: 15 }}>
            <h3 style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>Nueva factura de servicio</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
              <div className="field"><label>Subcuenta</label><select className="inp" value={form.subaccount} onChange={(e) => setForm({ ...form, subaccount: e.target.value })}>{Object.entries(SUBS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label>Proveedor</label><input className="inp" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Edenor S.A." /></div>
              <div className="field"><label>CUIT</label><input className="inp" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder="30-..." /></div>
              <div className="field"><label>Centro de costo</label><select className="inp" value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })}><option>Administración</option><option>Ventas</option><option>Producción</option><option>General</option></select></div>
              <div className="field" style={{ gridColumn: "span 2" }}><label>Concepto</label><input className="inp" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Consumo eléctrico — Jul 2026" /></div>
              <div className="field"><label>Fecha emisión</label><input className="inp" type="date" value={form.docDate} onChange={(e) => setForm({ ...form, docDate: e.target.value })} /></div>
              <div className="field"><label>Vencimiento</label><input className="inp" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div className="field"><label>Importe bruto</label><input className="inp mono" value={form.gross} onChange={(e) => setForm({ ...form, gross: e.target.value })} placeholder="0" inputMode="decimal" /></div>
              <div className="field"><label>IVA</label><select className="inp" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })}><option value="21">21%</option><option value="10.5">10,5%</option><option value="27">27%</option><option value="0">Exento</option></select></div>
              <div className="field"><label>IVA ($)</label><input className="inp mono" value={"$ " + nf(vatN)} readOnly /></div>
              <div className="field"><label>Total</label><input className="inp mono" value={"$ " + nf(totalN)} readOnly style={{ color: "var(--acc)", fontWeight: 700 }} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end", alignItems: "center" }}>
              <span className="pill pill-mute" style={{ marginRight: "auto" }}>Queda <b style={{ color: "var(--ink-2)" }}>pendiente de pago</b> hasta el pago real</span>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={pending}><Icon name="check" size={15} /> {pending ? "Guardando…" : "Registrar factura"}</button>
            </div>
          </div>
        )}

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Subcuenta</th><th>Proveedor / CUIT</th><th>Concepto</th><th>Emisión</th><th>Vencim.</th><th className="num">Total</th><th className="num">Saldo</th><th>Estado</th><th style={{ textAlign: "right" }}>Acción</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 22 }}>Sin facturas · usá “Nuevo asiento”</td></tr>
              ) : filtered.map((r) => {
                const est = r.settlement === "pagado" ? ["pill-ok", "Pagado"] : r.vencida ? ["pill-bad", "Vencido"] : r.settlement === "parcial" ? ["pill-warn", "Parcial"] : ["pill-warn", "Pendiente"];
                return (
                  <tr key={r.id}>
                    <td><span className="pill pill-plain">{SUBS[r.subaccount] ?? r.subaccount}</span></td>
                    <td><div style={{ color: "var(--ink-2)", fontWeight: 500 }}>{r.provider}</div><div className="muted" style={{ fontSize: 11 }}>{r.taxId}</div></td>
                    <td style={{ maxWidth: 220, fontSize: 12 }}>{r.concept}</td>
                    <td className="tnum">{fmtDate(r.docDate)}</td>
                    <td><span className={"pill " + (r.vencida ? "pill-bad" : "pill-mute")}>{fmtDate(r.dueDate)}</span></td>
                    <td className="num tnum">{money(r.total)}</td>
                    <td className="num tnum" style={{ color: r.balance > 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{money(r.balance)}</td>
                    <td><span className={"pill " + est[0]}>{est[1]}</span></td>
                    <td style={{ textAlign: "right" }}>
                      {r.settlement !== "pagado" ? (
                        payId === r.id ? (
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                            <div className="in-field" style={{ width: 110, padding: "0 8px" }}><span>$</span><input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={nf(r.balance)} style={{ fontSize: 13, padding: "6px 0" }} /></div>
                            <select className="inp" style={{ width: 120, padding: "6px 8px" }} value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}>
                              <option value="transferencia">Transf.</option><option value="efectivo">Efectivo</option><option value="cheque_propio">Cheque</option>
                            </select>
                            <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => confirmarPago(r)} disabled={pending}>Ok</button>
                            <button className="btn" style={{ padding: "6px 8px", fontSize: 12 }} onClick={() => setPayId(null)}>×</button>
                          </div>
                        ) : (
                          <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => { setPayId(r.id); setPayAmount(""); }}><Icon name="wallet" size={13} /> Pagar</button>
                        )
                      ) : <span className="muted" style={{ fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
