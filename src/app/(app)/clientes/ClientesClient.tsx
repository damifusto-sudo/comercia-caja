"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { upsertCliente, type ClienteInput } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const initials = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const fmtDate = (d: string | null) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return day && m ? `${day}/${m}/${y?.slice(2) ?? ""}` : d; };

export type DocLite = { number: string; doc_date: string; due_date: string | null; total: number; balance_due: number; settlement: string };
export type Cliente = {
  id: string; name: string; taxId: string; kind: "cliente" | "ambos";
  classification: string; taxCondition: string; contactName: string; phone: string; email: string;
  address: string; city: string; creditLimit: number; notes: string;
  saldo: number; vencido: number; ult: string | null; docs: DocLite[];
};

const TAX_CONDS = [
  { v: "responsable_inscripto", l: "Responsable Inscripto" },
  { v: "monotributo", l: "Monotributo" },
  { v: "consumidor_final", l: "Consumidor Final" },
  { v: "exento", l: "Exento" },
];
const taxLabel = (v: string) => TAX_CONDS.find((t) => t.v === v)?.l ?? (v || "—");
const emptyForm: ClienteInput = { name: "", taxId: "", kind: "cliente", classification: "", taxCondition: "", contactName: "", phone: "", email: "", address: "", city: "", creditLimit: 0, notes: "" };

export default function ClientesClient({ clientes, canEdit }: { clientes: Cliente[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState(clientes[0]?.id ?? "");
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<ClienteInput>(emptyForm);
  const [creditStr, setCreditStr] = useState("0");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) => (c.name + " " + c.taxId + " " + c.city + " " + c.contactName + " " + c.phone).toLowerCase().includes(t));
  }, [q, clientes]);

  const sel = clientes.find((c) => c.id === selId) ?? list[0] ?? clientes[0];

  function openNew() { setForm(emptyForm); setCreditStr("0"); setEditing("new"); setMsg(null); }
  function openEdit(c: Cliente) {
    setForm({ id: c.id, name: c.name, taxId: c.taxId, kind: c.kind, classification: c.classification, taxCondition: c.taxCondition, contactName: c.contactName, phone: c.phone, email: c.email, address: c.address, city: c.city, creditLimit: c.creditLimit, notes: c.notes });
    setCreditStr(String(c.creditLimit || 0));
    setEditing(c.id); setMsg(null);
  }

  function save() {
    const creditLimit = Math.round(parseFloat(creditStr.replace(/\./g, "").replace(",", ".")) || 0);
    setMsg(null);
    start(async () => {
      const res = await upsertCliente({ ...form, creditLimit });
      if (res.ok) { setEditing(null); if (res.id) setSelId(res.id); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "No se pudo guardar." });
    });
  }

  const F = (k: keyof ClienteInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const disponible = sel ? sel.creditLimit - sel.saldo : 0;

  return (
    <>
      <Topbar title="Clientes · CRM" subtitle={`${clientes.length} fichas`} />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <div className="in-field" style={{ minWidth: 240 }}><Icon name="users" size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CUIT, teléfono…" /></div>
          <span className="muted" style={{ fontSize: 12 }}>Registro completo de clientes con su cuenta corriente.</span>
          <div style={{ flex: 1 }} />
          {canEdit && <button className="btn btn-primary" onClick={openNew}><Icon name="idcard" size={15} /> Nueva ficha</button>}
        </div>

        {clientes.length === 0 ? (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
            Todavía no hay clientes. {canEdit ? "Creá la primera ficha con “Nueva ficha”." : ""}
          </div>
        ) : (
          <div className="split" style={{ gridTemplateColumns: "320px 1fr" }}>
            {/* Lista */}
            <div className="card" style={{ alignSelf: "start", maxHeight: "72vh", overflowY: "auto" }}>
              <div className="cx-panel-h"><h3>Clientes</h3><span className="muted" style={{ fontSize: 11 }}>{list.length}</span></div>
              {list.map((c) => (
                <button key={c.id} onClick={() => setSelId(c.id)} className="prov-item" style={c.id === sel?.id ? { background: "var(--acc-soft)" } : undefined}>
                  <span className="avat" style={{ background: "linear-gradient(150deg,var(--acc),#1f66b8)", color: "#022" }}>{initials(c.name)}</span>
                  <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{c.taxId || c.city || "—"}</div>
                  </div>
                  {c.saldo > 0.5
                    ? <span className="tnum" style={{ color: c.vencido > 0.5 ? "var(--red)" : "var(--amber)", fontSize: 12, fontWeight: 600 }}>{money(c.saldo)}</span>
                    : <span className="pill pill-ok">Al día</span>}
                </button>
              ))}
              {list.length === 0 && <div className="muted" style={{ padding: 18, fontSize: 12.5 }}>Sin resultados para “{q}”.</div>}
            </div>

            {/* Ficha */}
            {sel && (
              <div className="card">
                <div className="cx-panel-h" style={{ gap: 12 }}>
                  <span className="avat" style={{ background: "linear-gradient(150deg,var(--acc),#1f66b8)", color: "#022", width: 42, height: 42, fontSize: 15 }}>{initials(sel.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ textTransform: "none", letterSpacing: "normal", fontSize: 16, color: "var(--ink-2)" }}>{sel.name}</h3>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 3 }}>
                      <span className="muted" style={{ fontSize: 11 }}>{sel.taxId ? "CUIT/DNI " + sel.taxId : "sin identificación fiscal"}</span>
                      {sel.classification && <span className="pill pill-plain">{sel.classification}</span>}
                      {sel.kind === "ambos" && <span className="pill pill-blue">También proveedor</span>}
                    </div>
                  </div>
                  {sel.saldo > 0.5
                    ? <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 10 }}>Saldo cta. cte.</div><div className="tnum" style={{ color: sel.vencido > 0.5 ? "var(--red)" : "var(--amber)", fontSize: 18, fontWeight: 700 }}>{money(sel.saldo)}</div></div>
                    : <span className="pill pill-ok" style={{ display: "inline-flex" }}><Icon name="check" size={13} /> Al día</span>}
                  {canEdit && <button className="btn" onClick={() => openEdit(sel)} style={{ marginLeft: 4 }}><Icon name="receipt" size={14} /> Editar</button>}
                </div>

                {/* Datos de contacto */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--line)" }}>
                  {[
                    ["Contacto", sel.contactName], ["Teléfono", sel.phone], ["Email", sel.email],
                    ["Dirección", sel.address], ["Localidad", sel.city], ["Cond. IVA", taxLabel(sel.taxCondition)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: "var(--panel-2)", padding: "12px 16px", minWidth: 0 }}>
                      <div className="muted" style={{ fontSize: 10.5 }}>{label}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: val ? "var(--ink-2)" : "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Resumen comercial */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--line)", borderTop: "1px solid var(--line)" }}>
                  <div style={{ background: "var(--panel)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 10.5 }}>Saldo</div><div className="tnum" style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-2)" }}>{money(sel.saldo)}</div></div>
                  <div style={{ background: "var(--panel)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 10.5 }}>Vencido</div><div className="tnum" style={{ fontWeight: 700, fontSize: 15, color: sel.vencido > 0.5 ? "var(--red)" : "var(--dim)" }}>{money(sel.vencido)}</div></div>
                  <div style={{ background: "var(--panel)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 10.5 }}>Límite de crédito</div><div className="tnum" style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-2)" }}>{sel.creditLimit > 0 ? money(sel.creditLimit) : "—"}</div></div>
                  <div style={{ background: "var(--panel)", padding: "13px 16px" }}><div className="muted" style={{ fontSize: 10.5 }}>Crédito disponible</div><div className="tnum" style={{ fontWeight: 700, fontSize: 15, color: sel.creditLimit <= 0 ? "var(--dim)" : disponible < 0 ? "var(--red)" : "var(--green)" }}>{sel.creditLimit > 0 ? money(disponible) : "sin límite"}</div></div>
                </div>

                {/* Facturas recientes */}
                <div className="cx-panel-h" style={{ borderTop: "1px solid var(--line)" }}><h3>Facturas recientes</h3><span className="muted" style={{ fontSize: 11 }}>Últ. compra: {fmtDate(sel.ult)}</span></div>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead><tr><th>Comprobante</th><th>Fecha</th><th>Vence</th><th className="num">Total</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
                    <tbody>
                      {sel.docs.length === 0 ? (
                        <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>Sin facturas registradas.</td></tr>
                      ) : sel.docs.map((d, i) => {
                        const est = d.settlement === "pagado" ? ["pill-ok", "Pagada"] : d.settlement === "parcial" ? ["pill-warn", "Parcial"] : ["pill-mute", "Pendiente"];
                        return (
                          <tr key={i}>
                            <td className="muted">{d.number || "—"}</td>
                            <td className="tnum">{fmtDate(d.doc_date)}</td>
                            <td className="tnum">{fmtDate(d.due_date)}</td>
                            <td className="num tnum">{money(d.total)}</td>
                            <td className="num tnum" style={{ color: d.balance_due > 0.5 ? "var(--ink-2)" : "var(--dim)", fontWeight: 600 }}>{money(d.balance_due)}</td>
                            <td><span className={"pill " + est[0]}>{est[1]}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {sel.notes && (
                  <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
                    <div className="muted" style={{ fontSize: 10.5, marginBottom: 4 }}>Notas</div>
                    <div style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{sel.notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulario */}
      {editing && (
        <div className="mp-modal" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="mp-modal-card" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 15, color: "var(--ink-2)" }}>{editing === "new" ? "Nueva ficha de cliente" : "Editar cliente"}</h3>
            <div className="field"><label>Nombre / Razón social *</label><input className="inp" value={form.name} onChange={F("name")} placeholder="Ej: Almacén Doña Rosa" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>CUIT / DNI</label><input className="inp" value={form.taxId} onChange={F("taxId")} placeholder="20-12345678-9" /></div>
              <div className="field"><label>Condición IVA</label>
                <select className="inp" value={form.taxCondition} onChange={F("taxCondition")}>
                  <option value="">—</option>
                  {TAX_CONDS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Tipo</label>
                <select className="inp" value={form.classification} onChange={F("classification")}>
                  <option value="">—</option>
                  <option value="Minorista">Minorista</option>
                  <option value="Mayorista">Mayorista</option>
                  <option value="Distribuidor">Distribuidor</option>
                </select>
              </div>
              <div className="field"><label>Relación</label>
                <select className="inp" value={form.kind} onChange={F("kind")}>
                  <option value="cliente">Sólo cliente</option>
                  <option value="ambos">Cliente y proveedor</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Persona de contacto</label><input className="inp" value={form.contactName} onChange={F("contactName")} placeholder="Nombre y apellido" /></div>
              <div className="field"><label>Teléfono</label><input className="inp" value={form.phone} onChange={F("phone")} placeholder="11 5555-5555" /></div>
            </div>
            <div className="field"><label>Email</label><input className="inp" value={form.email} onChange={F("email")} placeholder="cliente@email.com" inputMode="email" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="field"><label>Dirección</label><input className="inp" value={form.address} onChange={F("address")} placeholder="Calle 123" /></div>
              <div className="field"><label>Localidad</label><input className="inp" value={form.city} onChange={F("city")} placeholder="Ciudad" /></div>
            </div>
            <div className="field"><label>Límite de crédito</label><div className="in-field"><span>$</span><input value={creditStr} onChange={(e) => setCreditStr(e.target.value)} inputMode="decimal" placeholder="0" /></div></div>
            <div className="field"><label>Notas</label><textarea className="inp" value={form.notes} onChange={F("notes")} rows={3} placeholder="Observaciones, acuerdos, preferencias…" style={{ resize: "vertical", fontFamily: "inherit" }} /></div>
            {msg && !msg.ok && <div style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{msg.text}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar ficha"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
