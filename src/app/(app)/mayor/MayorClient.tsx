"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtDate = (d: string) => d.split("-").reverse().join("/");

export type Account = { id: string; code: string; name: string; type: string; debe: number; haber: number };
export type Line = { code: string; name: string; debit: number; credit: number };
export type Entry = { id: string; date: string; event: string; lines: Line[] };

export default function MayorClient({ accounts, entries }: { accounts: Account[]; entries: Entry[] }) {
  const [tab, setTab] = useState<"sumas" | "diario" | "mayor">("sumas");
  const [accCode, setAccCode] = useState(accounts[0]?.code ?? "");

  const totDebe = accounts.reduce((s, a) => s + a.debe, 0);
  const totHaber = accounts.reduce((s, a) => s + a.haber, 0);

  // Mayor por cuenta: movimientos con saldo acumulado
  const acc = accounts.find((a) => a.code === accCode);
  const movs: { date: string; event: string; debit: number; credit: number; saldo: number }[] = [];
  if (acc) {
    let saldo = 0;
    for (const e of entries) {
      for (const l of e.lines) {
        if (l.code === accCode) {
          saldo += l.debit - l.credit;
          movs.push({ date: e.date, event: e.event, debit: l.debit, credit: l.credit, saldo });
        }
      }
    }
  }

  return (
    <>
      <Topbar title="Libro mayor" subtitle="Contabilidad · partida doble" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <div className="seg">
            <button className={tab === "sumas" ? "on" : ""} onClick={() => setTab("sumas")}>Sumas y saldos</button>
            <button className={tab === "diario" ? "on" : ""} onClick={() => setTab("diario")}>Libro diario</button>
            <button className={tab === "mayor" ? "on" : ""} onClick={() => setTab("mayor")}>Mayor por cuenta</button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {Math.abs(totDebe - totHaber) < 0.01
              ? "Partida doble balanceada ✓"
              : "⚠ Descuadre: revisar"}
          </span>
        </div>

        {tab === "sumas" && (
          <div className="card" style={{ overflowX: "auto" }}>
            <div className="cx-panel-h"><h3>Balance de sumas y saldos</h3></div>
            <table className="tbl">
              <thead><tr><th>Cuenta</th><th>Tipo</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {accounts.map((a) => {
                  const saldo = a.debe - a.haber;
                  return (
                    <tr key={a.id}>
                      <td><b style={{ color: "var(--ink-2)" }}>{a.code}</b> · {a.name}</td>
                      <td><span className="pill pill-mute">{a.type}</span></td>
                      <td className="num tnum">{money(a.debe)}</td>
                      <td className="num tnum">{money(a.haber)}</td>
                      <td className="num tnum" style={{ fontWeight: 600, color: "var(--ink-2)" }}>
                        {money(Math.abs(saldo))} <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{saldo >= 0 ? "deudor" : "acreedor"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--acc-line)" }}>
                  <td colSpan={2} style={{ fontWeight: 700, color: "var(--ink-2)", padding: "12px 15px" }}>Totales</td>
                  <td className="num tnum" style={{ fontWeight: 700, color: "var(--acc)" }}>{money(totDebe)}</td>
                  <td className="num tnum" style={{ fontWeight: 700, color: "var(--acc)" }}>{money(totHaber)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === "diario" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {entries.length === 0 ? (
              <div className="card card-pad muted">Sin asientos registrados.</div>
            ) : entries.map((e) => (
              <div key={e.id} className="card">
                <div className="cx-panel-h">
                  <h3 style={{ textTransform: "none", letterSpacing: "normal", fontSize: 13, color: "var(--ink-2)" }}>{e.event}</h3>
                  <div style={{ flex: 1 }} />
                  <span className="muted tnum" style={{ fontSize: 12 }}>{fmtDate(e.date)}</span>
                </div>
                <table className="tbl">
                  <thead><tr><th>Cuenta</th><th className="num">Debe</th><th className="num">Haber</th></tr></thead>
                  <tbody>
                    {e.lines.map((l, i) => (
                      <tr key={i}>
                        <td style={{ paddingLeft: l.credit > 0 ? 34 : 15, color: l.credit > 0 ? "var(--dim)" : "var(--ink-2)" }}>{l.name}</td>
                        <td className="num tnum">{l.debit > 0 ? money(l.debit) : ""}</td>
                        <td className="num tnum">{l.credit > 0 ? money(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {tab === "mayor" && (
          <div className="card">
            <div className="cx-panel-h" style={{ gap: 12 }}>
              <h3>Mayor de la cuenta</h3>
              <select className="inp" style={{ width: 280 }} value={accCode} onChange={(e) => setAccCode(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}
              </select>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th></tr></thead>
                <tbody>
                  {movs.length === 0 ? (
                    <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 22 }}>Sin movimientos</td></tr>
                  ) : movs.map((m, i) => (
                    <tr key={i}>
                      <td className="tnum">{fmtDate(m.date)}</td>
                      <td>{m.event}</td>
                      <td className="num tnum">{m.debit > 0 ? money(m.debit) : ""}</td>
                      <td className="num tnum">{m.credit > 0 ? money(m.credit) : ""}</td>
                      <td className="num tnum" style={{ fontWeight: 600, color: "var(--ink-2)" }}>
                        {money(Math.abs(m.saldo))} <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{m.saldo >= 0 ? "D" : "A"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
