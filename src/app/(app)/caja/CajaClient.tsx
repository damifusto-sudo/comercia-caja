"use client";

import { useState, useTransition } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";
import { cobrarACuenta, pagarProveedor } from "../ventas/actions";
import { registrarEgreso } from "../ventas/egreso";
import { PosBoard, type ClienteLite, type PosItem, type QrWallet, type PayAccount } from "../ventas/VentasPOS";

/** Saldo del día por medio (ingresos − egresos) + movimientos, desde caja_saldo_today. */
export type CajaSaldoRow = {
  medio: string;
  code: string;
  ingresos: number;
  egresos: number;
  saldo: number;
  movs: { time: string; concept: string; amount: number }[];
};

const MEDIO_META: Record<string, { label: string; icon: string; led: string }> = {
  efectivo: { label: "Efectivo", icon: "cash", led: "green" },
  electronico: { label: "Electrónico", icon: "wallet", led: "cyan" },
  tarjeta: { label: "Tarjeta", icon: "card", led: "acc" },
  cheque: { label: "Cheque", icon: "receipt", led: "amber" },
};

/**
 * Ventana única del operador: su caja individual con las ventas integradas.
 * Arriba, el saldo del día por medio (ingresos − egresos) con drill-down a los
 * movimientos. Opera cobros a cuenta, pagos a proveedor y egresos (gasto/retiro),
 * y vende con todos los medios (PosBoard). El POS es el mismo de /ventas.
 */
export default function CajaClient({
  clientes,
  proveedores,
  products,
  branchId,
  qrWallets,
  cardAccounts,
  cajaName,
  operator,
  saldo,
  showSaldos = true,
}: {
  clientes: ClienteLite[];
  proveedores: ClienteLite[];
  products: PosItem[];
  branchId: string;
  qrWallets: QrWallet[];
  cardAccounts: PayAccount[];
  cajaName: string;
  operator: string;
  saldo: CajaSaldoRow[];
  /** los saldos del día se ocultan en la estación de caja (cajero) */
  showSaldos?: boolean;
}) {
  const [openMedio, setOpenMedio] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "cobro" | "pago" | "egreso">(null);

  const [cobCliente, setCobCliente] = useState("");
  const [cobMonto, setCobMonto] = useState("");
  const [cobBusy, startCob] = useTransition();
  const [cobFlash, setCobFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const [pagProv, setPagProv] = useState("");
  const [pagMonto, setPagMonto] = useState("");
  const [pagBusy, startPag] = useTransition();
  const [pagFlash, setPagFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const [egKind, setEgKind] = useState<"gasto" | "retiro">("gasto");
  const [egConcepto, setEgConcepto] = useState("");
  const [egMonto, setEgMonto] = useState("");
  const [egBusy, startEg] = useTransition();
  const [egFlash, setEgFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const parseMonto = (s: string) => Math.round(parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0);
  const flashStyle = (ok: boolean) =>
    ok
      ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" }
      : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" };

  function cobrarCuenta() {
    const monto = parseMonto(cobMonto);
    if (!cobCliente) { setCobFlash({ ok: false, text: "Elegí el cliente." }); return; }
    if (!(monto > 0)) { setCobFlash({ ok: false, text: "Ingresá el importe a cobrar." }); return; }
    setCobFlash(null);
    startCob(async () => {
      const res = await cobrarACuenta({ partyId: cobCliente, amount: monto, instrument: "efectivo", source: "caja", sourceRef: cajaName });
      if (!res.ok) { setCobFlash({ ok: false, text: res.error ?? "No se pudo registrar." }); return; }
      let text: string;
      if (res.error) text = `Cobro ${money(monto)} registrado, pero la conciliación falló: ${res.error} → Excepciones`;
      else if (!res.conciliated) text = `Cobro ${money(monto)} registrado · pendiente de conciliación → Bandeja de excepciones`;
      else if ((res.credit ?? 0) > 0) text = `Cobrado ${money(monto)} · crédito a favor ${money(res.credit!)} → Excepciones`;
      else text = `Cobrado ${money(monto)} · imputado a facturas ✓`;
      setCobFlash({ ok: !res.error, text });
      if (!res.error) { setCobMonto(""); setCobCliente(""); }
    });
  }

  function pagar() {
    const monto = parseMonto(pagMonto);
    if (!pagProv) { setPagFlash({ ok: false, text: "Elegí el proveedor." }); return; }
    if (!(monto > 0)) { setPagFlash({ ok: false, text: "Ingresá el importe a pagar." }); return; }
    setPagFlash(null);
    startPag(async () => {
      const res = await pagarProveedor({ partyId: pagProv, amount: monto, sourceRef: cajaName });
      if (!res.ok) { setPagFlash({ ok: false, text: res.error ?? "No se pudo registrar." }); return; }
      let text: string;
      if (res.error) text = `Pago ${money(monto)} registrado, pero la conciliación falló: ${res.error} → Excepciones`;
      else if (!res.conciliated) text = `Pago ${money(monto)} en efectivo registrado · pendiente de autorización → Bandeja de excepciones`;
      else if ((res.credit ?? 0) > 0) text = `Pagado ${money(monto)} · saldo a favor ${money(res.credit!)} → Excepciones`;
      else text = `Pagado ${money(monto)} en efectivo · imputado a facturas del proveedor ✓`;
      setPagFlash({ ok: !res.error, text });
      if (!res.error) { setPagMonto(""); setPagProv(""); }
    });
  }

  function registrarEg() {
    const monto = parseMonto(egMonto);
    if (!(monto > 0)) { setEgFlash({ ok: false, text: "Ingresá el importe." }); return; }
    setEgFlash(null);
    startEg(async () => {
      const res = await registrarEgreso(egKind, egConcepto, monto);
      if (!res.ok) { setEgFlash({ ok: false, text: res.error ?? "No se pudo registrar el egreso." }); return; }
      setEgFlash({ ok: true, text: `${egKind === "gasto" ? "Gasto" : "Retiro"} de ${money(monto)} en efectivo registrado ✓` });
      setEgMonto(""); setEgConcepto("");
    });
  }

  const totIn = saldo.reduce((s, r) => s + Number(r.ingresos), 0);
  const totOut = saldo.reduce((s, r) => s + Number(r.egresos), 0);

  return (
    <>
      <Topbar title="Caja" subtitle={`${cajaName} · ${operator}`} />
      <div className="cx-view">
        {/* Mi caja + acciones de caja */}
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 15 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--acc-soft)", fontSize: 20 }}>🧾</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{cajaName}</div>
            <div className="muted" style={{ fontSize: 12 }}>Operador: {operator} · <span style={{ color: "var(--green)" }}>turno abierto</span></div>
          </div>
          <span style={{ flex: 1 }} />
          <button className={"btn" + (panel === "cobro" ? " btn-primary" : "")} onClick={() => { setPanel((p) => (p === "cobro" ? null : "cobro")); setCobFlash(null); }}><Icon name="users" size={16} /> Cobrar a cuenta</button>
          <button className={"btn" + (panel === "pago" ? " btn-primary" : "")} onClick={() => { setPanel((p) => (p === "pago" ? null : "pago")); setPagFlash(null); }}><Icon name="truck" size={16} /> Pago proveedor</button>
          <button className={"btn" + (panel === "egreso" ? " btn-primary" : "")} onClick={() => { setPanel((p) => (p === "egreso" ? null : "egreso")); setEgFlash(null); }}><Icon name="wallet" size={16} /> Registrar egreso</button>
        </div>

        {/* Saldo de caja del día — OCULTO en la estación de caja (cajero) */}
        {!showSaldos && (
          <div className="card card-pad" style={{ marginBottom: 15, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="shield" size={16} />
            <span className="muted" style={{ fontSize: 12.5 }}>Los saldos y totales del día no se muestran en la caja. Los ve un responsable desde su cuenta.</span>
          </div>
        )}
        {showSaldos && (<>
        <div className="cx-panel-h" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 14 }}>Saldo de caja de hoy</h3>
          <span className="muted" style={{ fontSize: 11 }}>ingresos − egresos por medio · tocá un medio para ver los movimientos</span>
        </div>
        <div className="saldo" style={{ marginBottom: 15 }}>
          <div className="srow head"><span>Medio</span><span className="num">Ingresos</span><span className="num">Egresos</span><span className="num">Saldo</span><span /></div>
          {saldo.map((r) => {
            const meta = MEDIO_META[r.medio] ?? { label: r.medio, icon: "cash", led: "green" };
            const op = openMedio === r.medio;
            return (
              <div key={r.medio}>
                <div className={"srow medio" + (op ? " open" : "")} onClick={() => setOpenMedio(op ? null : r.medio)}>
                  <span className="m-nm"><span className={"cx-light " + meta.led} /><Icon name={meta.icon} size={15} /> {meta.label}</span>
                  <span className="num in">{money(Number(r.ingresos))}</span>
                  <span className="num out">{Number(r.egresos) > 0 ? "− " + money(Number(r.egresos)) : "—"}</span>
                  <span className="num bal">{money(Number(r.saldo))}</span>
                  <span className="exp">▸</span>
                </div>
                {op && (
                  <div className="sdetail">
                    {r.movs.length === 0 ? (
                      <div className="mv-empty">Sin movimientos hoy en este medio.</div>
                    ) : (
                      r.movs.map((m, i) => (
                        <div className="mv" key={i}>
                          <span className="mt">{m.time}</span>
                          <span className="mc">{m.concept}</span>
                          <span className={"ma " + (Number(m.amount) >= 0 ? "pos" : "neg")}>{Number(m.amount) >= 0 ? "+ " : "− "}{money(Math.abs(Number(m.amount)))}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="srow total"><span className="m-nm">Total del día</span><span className="num in">{money(totIn)}</span><span className="num out">{totOut > 0 ? "− " + money(totOut) : "—"}</span><span className="num bal">{money(totIn - totOut)}</span><span /></div>
        </div>
        </>)}

        {/* Cobro a cuenta corriente (efectivo) */}
        {panel === "cobro" && (
          <div className="card card-pad" style={{ marginBottom: 15, borderColor: "var(--acc-line)" }}>
            <div className="cx-panel-h" style={{ marginBottom: 10 }}><h3 style={{ fontSize: 14 }}>Cobro a cuenta corriente · efectivo</h3><span className="muted" style={{ fontSize: 11 }}>imputa por FIFO a las facturas del cliente</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div className="field" style={{ margin: 0 }}><label>Cliente</label>
                <select className="inp" value={cobCliente} onChange={(e) => setCobCliente(e.target.value)}><option value="">Elegí el cliente…</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="field" style={{ margin: 0 }}><label>Importe</label><input className="inp" value={cobMonto} onChange={(e) => setCobMonto(e.target.value)} placeholder="0" inputMode="decimal" /></div>
              <button className="btn btn-primary" onClick={cobrarCuenta} disabled={cobBusy} style={{ height: 40 }}>{cobBusy ? "…" : "Cobrar"}</button>
            </div>
            {cobFlash && <div className="note" style={{ marginTop: 10, ...flashStyle(cobFlash.ok) }}><Icon name={cobFlash.ok ? "check" : "alert"} size={16} /><span>{cobFlash.text}</span></div>}
          </div>
        )}

        {/* Pago a proveedor (efectivo) */}
        {panel === "pago" && (
          <div className="card card-pad" style={{ marginBottom: 15, borderColor: "var(--acc-line)" }}>
            <div className="cx-panel-h" style={{ marginBottom: 10 }}><h3 style={{ fontSize: 14 }}>Pago a proveedor · efectivo</h3><span className="muted" style={{ fontSize: 11 }}>egreso de caja · imputa por FIFO a las facturas del proveedor</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div className="field" style={{ margin: 0 }}><label>Proveedor</label>
                <select className="inp" value={pagProv} onChange={(e) => setPagProv(e.target.value)}><option value="">Elegí el proveedor…</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="field" style={{ margin: 0 }}><label>Importe</label><input className="inp" value={pagMonto} onChange={(e) => setPagMonto(e.target.value)} placeholder="0" inputMode="decimal" /></div>
              <button className="btn btn-primary" onClick={pagar} disabled={pagBusy} style={{ height: 40 }}>{pagBusy ? "…" : "Pagar"}</button>
            </div>
            {pagFlash && <div className="note" style={{ marginTop: 10, ...flashStyle(pagFlash.ok) }}><Icon name={pagFlash.ok ? "check" : "alert"} size={16} /><span>{pagFlash.text}</span></div>}
          </div>
        )}

        {/* Egreso de caja (gasto / retiro) */}
        {panel === "egreso" && (
          <div className="card card-pad" style={{ marginBottom: 15, borderColor: "var(--acc-line)" }}>
            <div className="cx-panel-h" style={{ marginBottom: 10 }}><h3 style={{ fontSize: 14 }}>Registrar egreso · efectivo</h3><span className="muted" style={{ fontSize: 11 }}>salida de caja: Debe {egKind === "gasto" ? "Gastos" : "Retiros"} / Haber Caja</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1.6fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div className="field" style={{ margin: 0 }}><label>Tipo</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className={"btn" + (egKind === "gasto" ? " btn-primary" : "")} style={{ padding: "8px 12px" }} onClick={() => setEgKind("gasto")}>Gasto</button>
                  <button type="button" className={"btn" + (egKind === "retiro" ? " btn-primary" : "")} style={{ padding: "8px 12px" }} onClick={() => setEgKind("retiro")}>Retiro</button>
                </div>
              </div>
              <div className="field" style={{ margin: 0 }}><label>{egKind === "retiro" ? "Motivo del retiro" : "Concepto"}</label><input className="inp" value={egConcepto} onChange={(e) => setEgConcepto(e.target.value)} placeholder={egKind === "retiro" ? "Ej. depósito banco, retiro de socio…" : "Ej. flete, limpieza, insumos…"} /></div>
              <div className="field" style={{ margin: 0 }}><label>Importe</label><input className="inp" value={egMonto} onChange={(e) => setEgMonto(e.target.value)} placeholder="0" inputMode="decimal" /></div>
              <button className="btn btn-primary" onClick={registrarEg} disabled={egBusy} style={{ height: 40 }}>{egBusy ? "…" : "Registrar"}</button>
            </div>
            {egFlash && <div className="note" style={{ marginTop: 10, ...flashStyle(egFlash.ok) }}><Icon name={egFlash.ok ? "check" : "alert"} size={16} /><span>{egFlash.text}</span></div>}
          </div>
        )}

        {/* Ventas — mismo POS, con todos los medios de pago */}
        <PosBoard clientes={clientes} products={products} branchId={branchId} qrWallets={qrWallets} cardAccounts={cardAccounts} />
      </div>
    </>
  );
}
