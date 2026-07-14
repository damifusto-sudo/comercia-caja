"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { chequeTransition } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "—");

export type ChequeRow = {
  id: string; number: string; bank: string; dueDate: string | null;
  status: "en_cartera" | "depositado" | "acreditado" | "rechazado" | "endosado";
  amount: number; type: string; origin: string;
};

const STATUS: Record<ChequeRow["status"], [string, string]> = {
  en_cartera: ["pill-warn", "En cartera"], depositado: ["pill-blue", "Depositado"],
  acreditado: ["pill-ok", "Acreditado"], rechazado: ["pill-bad", "Rechazado"], endosado: ["pill-mute", "Endosado"],
};

export default function ValoresClient({ cheques }: { cheques: ChequeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const enCartera = cheques.filter((c) => c.status === "en_cartera");
  const depositados = cheques.filter((c) => c.status === "depositado");
  const totCartera = enCartera.reduce((s, c) => s + c.amount, 0);
  const totDeposito = depositados.reduce((s, c) => s + c.amount, 0);

  function transition(c: ChequeRow, to: "depositado" | "acreditado") {
    setMsg(null);
    setBusyId(c.id);
    startTransition(async () => {
      const res = await chequeTransition(c.id, to);
      if (res.ok) setMsg({ ok: true, text: `Cheque ${c.number}: ${to === "depositado" ? "depositado" : "acreditado en banco"}.` });
      else setMsg({ ok: false, text: res.error ?? "No se pudo actualizar el cheque." });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <>
      <Topbar title="Valores a depositar" subtitle="Cheques de terceros" />
      <div className="cx-view">
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="card kpi"><div className="kpi-l">En cartera</div><div className="kpi-v" style={{ color: "var(--amber)" }}>{money(totCartera)}</div><div className="kpi-d">{enCartera.length} cheques</div></div>
          <div className="card kpi"><div className="kpi-l">Depositados (en tránsito)</div><div className="kpi-v" style={{ color: "var(--cyan)" }}>{money(totDeposito)}</div><div className="kpi-d">{depositados.length} cheques</div></div>
          <div className="card kpi"><div className="kpi-l">Total en valores</div><div className="kpi-v">{money(totCartera + totDeposito)}</div></div>
        </div>

        {msg && (
          <div className="note" style={{ margin: "15px 0 0", ...(msg.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
            <Icon name="check" size={16} /><span>{msg.text}</span>
          </div>
        )}

        <div className="cx-section-h"><h2 className="cx-h2">Cheques en cartera</h2></div>
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Nº cheque</th><th>Banco</th><th>Origen</th><th>Vencimiento</th><th className="num">Importe</th><th>Estado</th><th style={{ textAlign: "right" }}>Acción</th></tr></thead>
            <tbody>
              {cheques.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 22 }}>Sin cheques en cartera</td></tr>
              ) : cheques.map((c) => (
                <tr key={c.id}>
                  <td className="tnum"><b style={{ color: "var(--ink-2)" }}>{c.number}</b></td>
                  <td>{c.bank}</td>
                  <td>{c.origin}</td>
                  <td className="tnum">{fmtDate(c.dueDate)}</td>
                  <td className="num tnum">{money(c.amount)}</td>
                  <td><span className={"pill " + STATUS[c.status][0]}>{STATUS[c.status][1]}</span></td>
                  <td style={{ textAlign: "right" }}>
                    {c.status === "en_cartera" && (
                      <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }} disabled={pending && busyId === c.id} onClick={() => transition(c, "depositado")}>
                        <Icon name="vault" size={14} /> Depositar
                      </button>
                    )}
                    {c.status === "depositado" && (
                      <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} disabled={pending && busyId === c.id} onClick={() => transition(c, "acreditado")}>
                        <Icon name="check" size={14} /> Acreditar
                      </button>
                    )}
                    {(c.status === "acreditado" || c.status === "rechazado" || c.status === "endosado") && <span className="muted" style={{ fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
