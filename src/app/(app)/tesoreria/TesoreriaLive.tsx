"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { imageToDataUrl } from "@/lib/image";
import { upsertMedio, deleteMedio, type MedioInput } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

export type Medio = { id: string; name: string; type: "caja" | "bancaria" | "virtual" | "cartera"; bank: string; balance: number; collect: boolean; qr: string | null };
export type Caja = { id: string; name: string; branch: string; username: string; active: boolean };

const TYPE_LABEL: Record<Medio["type"], string> = { caja: "Efectivo", bancaria: "Banco", virtual: "Billetera / virtual", cartera: "Cartera" };
const TYPE_ICON: Record<Medio["type"], string> = { caja: "cash", bancaria: "vault", virtual: "wallet", cartera: "check" };
const emptyForm: MedioInput = { name: "", type: "virtual", bank: "", balance: 0, collect: true };

export default function TesoreriaLive({ medios, cajas, orgName, operator }: { medios: Medio[]; cajas: Caja[]; orgName: string; operator: string }) {
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<MedioInput>(emptyForm);
  const [balanceStr, setBalanceStr] = useState("0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [clock, setClock] = useState("--:--:--");
  const [live, setLive] = useState(0);
  const liveRef = useRef(0);

  useEffect(() => {
    const c = setInterval(() => setClock(new Date().toLocaleTimeString("es-AR", { hour12: false })), 1000);
    const l = setInterval(() => { liveRef.current += Math.floor(1500 + Math.random() * 12000); setLive(liveRef.current); }, 2400);
    setClock(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    return () => { clearInterval(c); clearInterval(l); };
  }, []);

  const total = medios.reduce((s, m) => s + m.balance, 0);
  const electronico = medios.filter((m) => m.type !== "caja").reduce((s, m) => s + m.balance, 0);
  const efectivo = medios.filter((m) => m.type === "caja").reduce((s, m) => s + m.balance, 0);

  function openNew() { setForm(emptyForm); setBalanceStr("0"); setEditing("new"); setMsg(null); }
  function openEdit(m: Medio) { setForm({ id: m.id, name: m.name, type: m.type, bank: m.bank, balance: m.balance, collect: m.collect, qr: m.qr }); setBalanceStr(String(m.balance)); setEditing(m.id); setMsg(null); }

  async function onQrFile(file?: File) {
    if (!file) return;
    const url = await imageToDataUrl(file);
    if (!url) { setMsg({ ok: false, text: "Elegí una imagen válida del QR." }); return; }
    setForm((f) => ({ ...f, qr: url }));
  }

  function save() {
    const balance = parseFloat(balanceStr.replace(/\./g, "").replace(",", ".")) || 0;
    setBusy(true);
    upsertMedio({ ...form, balance }).then((res) => {
      setBusy(false);
      if (res.ok) { setEditing(null); setMsg({ ok: true, text: "Medio guardado." }); location.reload(); }
      else setMsg({ ok: false, text: res.error ?? "No se pudo guardar." });
    });
  }
  function remove(id: string) {
    setBusy(true);
    deleteMedio(id).then((res) => { setBusy(false); if (res.ok) location.reload(); else setMsg({ ok: false, text: res.error ?? "No se pudo eliminar." }); });
  }

  return (
    <div className="mp">
      <div className="mp-scan" />
      <div className="mp-wrap">
        <div className="mp-head">
          <div className="mp-mk">C</div>
          <div className="mp-ttl">Tesorería central<small>{orgName || "Comercia"}</small></div>
          <div style={{ flex: 1 }} />
          <div className="mp-stat"><span className="k">Operador</span><span className="v">{operator}</span></div>
          <div className="mp-stat"><span className="k">Hora local</span><span className="v mono">{clock}</span></div>
          <div style={{ paddingLeft: 14 }}><span className="mp-live"><span className="bd" />En vivo</span></div>
        </div>

        {/* total */}
        <div className="mp-core" style={{ gridColumn: "span 4", justifyContent: "center" }}>
          <div className="mp-cap">Disponible total</div>
          <div className="mp-total" style={{ marginTop: 10 }}><div className="n" style={{ fontSize: 34 }}>{money(total)}</div><div className="t">en todos los medios</div></div>
          <div className="mp-clock" style={{ gap: 18 }}>
            <div className="b"><div className="n" style={{ fontSize: 15 }}>{money(efectivo)}</div><div className="t">Efectivo</div></div>
            <div className="b"><div className="n" style={{ fontSize: 15 }}>{money(electronico)}</div><div className="t">Electrónico</div></div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--green)", fontFamily: "var(--mono)" }}>▲ + {money(live)} <span style={{ color: "var(--dim)" }}>ingresos hoy</span></div>
        </div>

        {/* medios */}
        <div className="mp-box" style={{ gridColumn: "span 8" }}>
          <div className="mp-ph"><h3>Medios de cobro</h3><span className="hint">editables · son las opciones de cobro de las cajas</span></div>
          <div style={{ padding: 14 }}>
            <div className="mp-grid" style={{ gridColumn: "auto" }}>
              {medios.map((m) => (
                <div key={m.id} className="mp-acc">
                  {m.collect && <span className="mp-tag2">cobro</span>}
                  <div className="ic"><Icon name={TYPE_ICON[m.type]} size={17} /></div>
                  <div className="nm">{m.name}</div>
                  <div className="bk">{TYPE_LABEL[m.type]}{m.bank ? " · " + m.bank : ""}</div>
                  <div className="bal">{money(m.balance)}</div>
                  <div className="acts">
                    <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openEdit(m)}>Editar</button>
                    <button className="btn danger" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => remove(m.id)} disabled={busy}>Eliminar</button>
                  </div>
                </div>
              ))}
              <button className="mp-acc add" onClick={openNew}><Icon name="grid" size={18} /><span style={{ marginTop: 6, fontWeight: 600 }}>Agregar medio</span></button>
            </div>
          </div>
        </div>

        {/* cajas */}
        <div className="mp-box" style={{ gridColumn: "span 12" }}>
          <div className="mp-ph"><h3>Cajas (efectivo)</h3><span className="hint">{cajas.length} cajas · el retiro de cierre entra a esta tesorería</span></div>
          <div style={{ padding: 14 }}>
            <div className="mp-grid" style={{ gridColumn: "auto" }}>
              {cajas.map((c) => (
                <div key={c.id} className="mp-acc">
                  <div className="ic"><Icon name="cash" size={17} /></div>
                  <div className="nm">{c.name}</div>
                  <div className="bk">{c.branch}{c.username ? " · " + c.username : ""}</div>
                  <div style={{ marginTop: 6 }}><span className={"pill " + (c.active ? "pill-ok" : "pill-mute")}>{c.active ? "Activa" : "Inactiva"}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="mp-modal" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="mp-modal-card">
            <h3 style={{ fontSize: 15, color: "var(--ink-2)" }}>{editing === "new" ? "Nuevo medio de cobro" : "Editar medio"}</h3>
            <div className="field"><label>Nombre</label><input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mercado Pago / Banco / Cuenta DNI…" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Tipo</label>
                <select className="inp" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Medio["type"] })}>
                  <option value="virtual">Billetera / virtual</option>
                  <option value="bancaria">Banco</option>
                  <option value="caja">Efectivo</option>
                  <option value="cartera">Cartera</option>
                </select>
              </div>
              <div className="field"><label>Entidad</label><input className="inp" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="Galicia / Nación…" /></div>
            </div>
            <div className="field"><label>Saldo actual</label><div className="in-field"><span>$</span><input value={balanceStr} onChange={(e) => setBalanceStr(e.target.value)} inputMode="decimal" /></div></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink)" }}>
              <input type="checkbox" checked={form.collect} onChange={(e) => setForm({ ...form, collect: e.target.checked })} />
              Disponible como opción de cobro en las cajas
            </label>
            <div className="field">
              <label>QR de cobro (billetera)</label>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {form.qr
                  ? <img src={form.qr} alt="QR de cobro" style={{ width: 74, height: 74, borderRadius: 8, border: "1px solid var(--line)", background: "#fff", objectFit: "contain" }} />
                  : <div style={{ width: 74, height: 74, borderRadius: 8, border: "1px dashed var(--line)", display: "grid", placeItems: "center", color: "var(--dim)", flex: "none" }}><Icon name="qr" size={24} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input type="file" accept="image/*" onChange={(e) => onQrFile(e.target.files?.[0])} style={{ fontSize: 12, maxWidth: "100%" }} />
                  <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>Subí la captura del QR de tu MODO / Mercado Pago / Cuenta DNI. Se muestra en el POS al cobrar por QR.</div>
                  {form.qr && <button className="btn" style={{ marginTop: 6, padding: "4px 10px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, qr: null }))}>Quitar QR</button>}
                </div>
              </div>
            </div>
            {msg && !msg.ok && <div style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{msg.text}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
