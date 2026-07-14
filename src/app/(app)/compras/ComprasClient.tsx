"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { receiveOrder, receiveOrderLines, confirmOrder, finalizeOrder } from "./actions";

const nf = (n: number) => Math.round(n).toLocaleString("es-AR");
const money = (n: number) => "$ " + nf(n);
const q = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
const VAT = 0.21;

export type OCItemView = { itemId: string; art: string; sec: string; sku: string; cant: number; recibido: number; costo: number };
export type OCView = {
  poId: string;
  code: string;
  prov: string;
  fecha: string;
  status: "recibida" | "en_transito" | "confirmada" | "borrador" | "anulada";
  items: OCItemView[];
};

const LABEL: Record<OCView["status"], string> = {
  recibida: "Recibida", en_transito: "En tránsito", confirmada: "Confirmada", borrador: "Borrador", anulada: "Anulada",
};
const PILL: Record<OCView["status"], string> = {
  recibida: "pill-ok", en_transito: "pill-warn", confirmada: "pill-warn", borrador: "pill-mute", anulada: "pill-bad",
};
const ocTotal = (o: OCView) => o.items.reduce((s, i) => s + i.cant * i.costo, 0);
const ocRecibido = (o: OCView) => o.items.reduce((s, i) => s + i.recibido, 0);
const ocPedido = (o: OCView) => o.items.reduce((s, i) => s + i.cant, 0);

function dispStatus(o: OCView): { label: string; cls: string } {
  const rec = ocRecibido(o), ped = ocPedido(o);
  if (o.status === "recibida") return { label: "Recibida", cls: "pill-ok" };
  if ((o.status === "en_transito" || o.status === "confirmada") && rec > 0.0001 && rec < ped - 0.0001)
    return { label: "Recibida parcial", cls: "pill-blue" };
  return { label: LABEL[o.status], cls: PILL[o.status] };
}

export default function ComprasClient({ ordenes, branchId }: { ordenes: OCView[]; branchId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selId, setSelId] = useState(ordenes[0]?.poId ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [lote, setLote] = useState<Record<string, string>>({});
  const [venc, setVenc] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);

  const o = ordenes.find((x) => x.poId === selId) ?? ordenes[0];
  const receivable = o && (o.status === "en_transito" || o.status === "confirmada");
  const isDraft = o && o.status === "borrador";

  // Al cambiar de orden (o al refrescar datos), precargar los inputs con lo pendiente
  useEffect(() => {
    const cur = ordenes.find((x) => x.poId === selId) ?? ordenes[0];
    if (!cur) { setRecv({}); return; }
    const init: Record<string, string> = {};
    cur.items.forEach((i) => { const p = Math.max(0, i.cant - i.recibido); init[i.itemId] = p > 0 ? q(p) : "0"; });
    setRecv(init);
    setLote({});
    setVenc({});
    setConfirmClose(false);
  }, [selId, ordenes]);

  function linesFromInputs(): { itemId: string; qty: number; lotCode?: string; expiry?: string }[] {
    if (!o) return [];
    return o.items
      .map((i) => {
        const pend = Math.max(0, i.cant - i.recibido);
        const raw = parseFloat((recv[i.itemId] ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
        return {
          itemId: i.itemId,
          qty: Math.min(Math.max(0, raw), pend),
          lotCode: lote[i.itemId] || undefined,
          expiry: venc[i.itemId] || undefined,
        };
      })
      .filter((l) => l.qty > 0);
  }

  function recibirCantidades() {
    if (!o) return;
    const lines = linesFromInputs();
    if (lines.length === 0) { setMsg({ ok: false, text: "Indicá al menos una cantidad a recibir." }); return; }
    setMsg(null);
    startTransition(async () => {
      const res = await receiveOrderLines(o.poId, lines, branchId);
      if (res.ok) {
        setMsg({ ok: true, text: res.complete
          ? `Recepción completa: se recibieron ${q(res.received ?? 0)} u. — orden cerrada.`
          : `Recepción parcial: ${q(res.received ?? 0)} u. sumadas al stock. Falta lo pendiente.` });
        router.refresh();
      } else {
        // No refrescamos: preservamos las cantidades tipeadas por el usuario.
        setMsg({ ok: false, text: res.error ?? "No se pudo registrar la recepción." });
      }
    });
  }

  function recibirTodo() {
    if (!o) return;
    setMsg(null);
    startTransition(async () => {
      const res = await receiveOrder(o.poId, branchId);
      if (res.ok) {
        setMsg({ ok: true, text: `Orden recibida completa: ${q(res.received ?? 0)} u. sumadas al stock.` });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "No se pudo registrar la recepción." });
      }
    });
  }

  function confirmar() {
    if (!o) return;
    setMsg(null);
    startTransition(async () => {
      const res = await confirmOrder(o.poId);
      if (res.ok) { setMsg({ ok: true, text: "Orden confirmada. Ya podés registrar la recepción." }); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "No se pudo confirmar la orden." });
    });
  }

  function finalizar() {
    if (!o) return;
    setConfirmClose(false);
    setMsg(null);
    startTransition(async () => {
      const res = await finalizeOrder(o.poId);
      if (res.ok) {
        setMsg({ ok: true, text: res.status === "anulada"
          ? "Orden anulada: no había ingresado ninguna cantidad."
          : "Orden cerrada. Se facturó lo recibido; lo pendiente se dio por no ingresado." });
        router.refresh();
      } else setMsg({ ok: false, text: res.error ?? "No se pudo cerrar la orden." });
    });
  }

  if (!o) {
    return (
      <>
        <Topbar title="Compras" subtitle="Órdenes y saldos" />
        <div className="cx-view"><div className="card card-pad muted">No hay órdenes de compra todavía.</div></div>
      </>
    );
  }

  const ds = dispStatus(o);
  const pendienteTot = Math.max(0, ocPedido(o) - ocRecibido(o));

  return (
    <>
      <Topbar title="Compras" subtitle="Órdenes y saldos" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12 }}>La recepción puede ser <b style={{ color: "var(--ink-2)" }}>parcial o total</b>. Lo no recibido sigue figurando como <b style={{ color: "var(--ink-2)" }}>En camino</b> en Stock.</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary"><Icon name="truck" size={15} /> Nueva orden</button>
        </div>
        <div className="split" style={{ gridTemplateColumns: "320px 1fr" }}>
          <div className="card" style={{ alignSelf: "start" }}>
            <div className="cx-panel-h"><h3>Órdenes de compra</h3></div>
            {ordenes.map((oc) => {
              const s = dispStatus(oc);
              return (
                <button key={oc.poId} onClick={() => { setSelId(oc.poId); setMsg(null); }} className="prov-item" style={oc.poId === selId ? { background: "var(--acc-soft)" } : undefined}>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink-2)" }}>{oc.code}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{oc.prov} · {oc.items.length} art. · {oc.fecha}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tnum" style={{ fontWeight: 600, color: "var(--ink-2)", fontSize: 12.5 }}>{money(ocTotal(oc))}</div>
                    <span className={"pill " + s.cls} style={{ marginTop: 3 }}>{s.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="card">
            <div className="cx-panel-h" style={{ gap: 12 }}>
              <h3 style={{ textTransform: "none", letterSpacing: "normal", fontSize: 15, color: "var(--ink-2)" }}>{o.code}</h3>
              <span className={"pill " + ds.cls}>{ds.label}</span>
              <div style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 11 }}>{o.prov} · {o.fecha}</span>
            </div>
            {receivable && (
              <div style={{ padding: "11px 17px", borderBottom: "1px solid var(--line)" }}>
                <div className="note" style={{ background: "color-mix(in srgb,var(--cyan) 12%,transparent)", color: "var(--cyan)", borderColor: "color-mix(in srgb,var(--cyan) 28%,transparent)" }}>
                  <Icon name="truck" size={16} /><span>Cargá cuánto llegó de cada artículo (viene precargado con lo pendiente). Podés recibir <b>parcial</b> o usar <b>Recibir todo lo pendiente</b>. {pendienteTot > 0 ? `Pendiente total: ${q(pendienteTot)} u.` : ""}</span>
                </div>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Artículo</th><th>Sección</th>
                    <th className="num">Pedido</th><th className="num">Recibido</th><th className="num">Pendiente</th>
                    <th className="num">Costo unit.</th>
                    {receivable && <th className="num">Recibir ahora</th>}
                    {receivable && <th>Lote</th>}
                    {receivable && <th>Vence</th>}
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => {
                    const pend = Math.max(0, i.cant - i.recibido);
                    return (
                      <tr key={i.itemId}>
                        <td style={{ fontWeight: 500, color: "var(--ink-2)" }}>{i.art}</td>
                        <td>{i.sec ? <span className="pill pill-mute">{i.sec}</span> : <span className="muted">—</span>}</td>
                        <td className="num tnum">{q(i.cant)}</td>
                        <td className="num tnum" style={{ color: i.recibido > 0 ? "var(--green)" : "var(--dim)" }}>{q(i.recibido)}</td>
                        <td className="num tnum" style={{ color: pend > 0 ? "var(--amber)" : "var(--dim)", fontWeight: pend > 0 ? 600 : 400 }}>{q(pend)}</td>
                        <td className="num tnum">$ {nf(i.costo)}</td>
                        {receivable && (
                          <td className="num">
                            {pend > 0 ? (
                              <input
                                className="inp"
                                style={{ width: 84, padding: "5px 8px", textAlign: "right" }}
                                inputMode="decimal"
                                value={recv[i.itemId] ?? ""}
                                onChange={(e) => setRecv((r) => ({ ...r, [i.itemId]: e.target.value }))}
                              />
                            ) : (
                              <span className="pill pill-ok" style={{ display: "inline-flex" }}><Icon name="check" size={12} /> Completo</span>
                            )}
                          </td>
                        )}
                        {receivable && (
                          <td>
                            {pend > 0 ? (
                              <input
                                className="inp"
                                style={{ width: 110, padding: "5px 8px" }}
                                placeholder="opcional"
                                value={lote[i.itemId] ?? ""}
                                onChange={(e) => setLote((r) => ({ ...r, [i.itemId]: e.target.value }))}
                              />
                            ) : <span className="muted">—</span>}
                          </td>
                        )}
                        {receivable && (
                          <td>
                            {pend > 0 ? (
                              <input
                                type="date"
                                className="inp"
                                style={{ width: 148, padding: "5px 8px" }}
                                value={venc[i.itemId] ?? ""}
                                onChange={(e) => setVenc((r) => ({ ...r, [i.itemId]: e.target.value }))}
                              />
                            ) : <span className="muted">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, padding: "14px 18px", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
              <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 11 }}>Recibido / Pedido</div><div style={{ fontWeight: 700, color: "var(--ink-2)" }}>{q(ocRecibido(o))} / {q(ocPedido(o))} u.</div></div>
              <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 11 }}>Neto</div><div style={{ fontWeight: 700, color: "var(--ink-2)" }}>{money(ocTotal(o))}</div></div>
              <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 11 }}>IVA 21%</div><div style={{ fontWeight: 700, color: "var(--ink-2)" }}>{money(ocTotal(o) * VAT)}</div></div>
              <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 11 }}>Total c/IVA</div><div style={{ fontWeight: 750, color: "var(--acc)", fontSize: 18, fontFamily: "var(--mono)" }}>{money(ocTotal(o) * (1 + VAT))}</div></div>
            </div>
            {msg && (
              <div style={{ padding: "0 18px 12px" }}>
                <div className="note" style={msg.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }}>
                  <Icon name={msg.ok ? "check" : "alert"} size={16} /><span>{msg.text}</span>
                </div>
              </div>
            )}
            {isDraft && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 18px 16px", flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: 12 }}>La orden está en borrador. Confirmala para poder registrar la recepción.</span>
                <div style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={confirmar} disabled={pending}>
                  <Icon name="check" size={15} /> {pending ? "Confirmando…" : "Confirmar orden"}
                </button>
              </div>
            )}
            {receivable && (
              <div style={{ display: "flex", gap: 10, padding: "0 18px 16px", flexWrap: "wrap" }}>
                <button className="btn btn-primary" style={{ flex: 1, minWidth: 190 }} onClick={recibirCantidades} disabled={pending}>
                  <Icon name="check" size={15} /> {pending ? "Registrando…" : "Recibir cantidades cargadas"}
                </button>
                <button className="btn" style={{ minWidth: 175 }} onClick={recibirTodo} disabled={pending}>
                  <Icon name="truck" size={15} /> Recibir todo lo pendiente
                </button>
                {!confirmClose ? (
                  <button className="btn danger" style={{ minWidth: 150 }} onClick={() => setConfirmClose(true)} disabled={pending}>
                    <Icon name="check" size={15} /> Cerrar orden
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--amber)" }}>¿Cerrar? Lo pendiente NO ingresará.</span>
                    <button className="btn danger" onClick={finalizar} disabled={pending}>Sí, cerrar</button>
                    <button className="btn" onClick={() => setConfirmClose(false)} disabled={pending}>No</button>
                  </div>
                )}
              </div>
            )}
            {o.status === "recibida" && (
              <div style={{ padding: "0 18px 16px" }}>
                <div className="pill pill-ok" style={{ display: "inline-flex" }}><Icon name="check" size={13} /> Orden recibida · stock y factura de compra actualizados</div>
              </div>
            )}
            {o.status === "anulada" && (
              <div style={{ padding: "0 18px 16px" }}>
                <div className="pill pill-bad" style={{ display: "inline-flex" }}><Icon name="alert" size={13} /> Orden anulada</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
