"use client";

import { useState, useTransition } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";
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

/** Medios de cobro del mostrador: efectivo, tarjeta y QR (sin cuenta corriente). */
const POS_METHODS = ["efectivo", "tarjeta", "qr"];

/**
 * Ventana única del mostrador: la caja con las ventas integradas.
 * Vende con efectivo / tarjeta / QR (PosBoard) y registra egresos de caja
 * (gasto / retiro). Arriba, el saldo del día por medio con drill-down (oculto
 * para el cajero). No hay cuenta corriente ni pagos a proveedor: este producto
 * es solo mostrador, sin los módulos que generan esas deudas.
 */
export default function CajaClient({
  clientes,
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
  const [panel, setPanel] = useState<null | "egreso">(null);

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
      <Topbar title="Ventas / Caja" subtitle={`${cajaName} · ${operator}`} />
      <div className="cx-view">
        {/* Mi caja + acción de egreso */}
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 15 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--acc-soft)", fontSize: 20 }}>🧾</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{cajaName}</div>
            <div className="muted" style={{ fontSize: 12 }}>Operador: {operator} · <span style={{ color: "var(--green)" }}>turno abierto</span></div>
          </div>
          <span style={{ flex: 1 }} />
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

        {/* Ventas — POS del mostrador: efectivo / tarjeta / QR */}
        <PosBoard clientes={clientes} products={products} branchId={branchId} qrWallets={qrWallets} cardAccounts={cardAccounts} methods={POS_METHODS} />
      </div>
    </>
  );
}
