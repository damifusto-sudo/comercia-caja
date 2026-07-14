"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { retryMatch, voidPayment, applyCreditTo, writeoffCredit } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

export type Exc = {
  id: string;
  kind: "pendiente" | "credito" | "cheque";
  partyId: string;
  party: string;
  direction: "cobro" | "pago";
  amount: number;
  source: string;
  sourceRef: string | null;
  date: string;
  detail: string | null;
};
export type OpenDoc = { id: string; number: string; balance_due: number; due_date: string | null };

const KIND: Record<Exc["kind"], { label: string; color: string; hint: string }> = {
  pendiente: { label: "Sin conciliar", color: "var(--amber)", hint: "Pago recibido sin aplicar a factura" },
  credito: { label: "Crédito a favor", color: "var(--cyan)", hint: "Sobrepago / cobro a cuenta" },
  cheque: { label: "Cheque rechazado", color: "var(--red)", hint: "Reversión — reclamar el valor" },
};

const SOURCE: Record<string, { label: string; icon: string; color: string }> = {
  ventas: { label: "Ventas", icon: "cart", color: "#2fe6c8" },
  caja: { label: "Caja", icon: "cash", color: "#39d98a" },
  cobranza: { label: "Cobranzas", icon: "users", color: "#5fe0a0" },
  pago: { label: "Pagos", icon: "wallet", color: "#43d6b0" },
  importacion: { label: "Importación", icon: "box", color: "#57d7ea" },
  manual: { label: "Manual", icon: "receipt", color: "#8aa" },
};

function since(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "hace " + s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return "hace " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "hace " + h + " h";
  return "hace " + Math.floor(h / 24) + " d";
}

export default function ExcepcionesLive({
  items,
  openDocs,
  orgName,
  operator,
  canEdit,
}: {
  items: Exc[];
  openDocs: Record<string, OpenDoc[]>;
  orgName: string;
  operator: string;
  canEdit: boolean;
}) {
  const [clock, setClock] = useState("--:--:--");
  const [, force] = useState(0);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [applyFor, setApplyFor] = useState<Exc | null>(null);

  useEffect(() => {
    const c = setInterval(() => setClock(new Date().toLocaleTimeString("es-AR", { hour12: false })), 1000);
    const t = setInterval(() => force((n) => n + 1), 15000); // refresca los "hace Xs"
    setClock(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    return () => { clearInterval(c); clearInterval(t); };
  }, []);

  const total = items.reduce((s, e) => s + e.amount, 0);
  const nPend = items.filter((e) => e.kind === "pendiente").length;
  const nCred = items.filter((e) => e.kind === "credito").length;
  const nChq = items.filter((e) => e.kind === "cheque").length;
  const montoCred = items.filter((e) => e.kind === "credito").reduce((s, e) => s + e.amount, 0);

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setBusyId(id);
    setFlash(null);
    start(async () => {
      const res = await fn();
      setBusyId(null);
      if (res.ok) { setApplyFor(null); setFlash({ ok: true, text: okText }); window.location.reload(); }
      else setFlash({ ok: false, text: res.error ?? "No se pudo completar la acción." });
    });
  }

  return (
    <div className="mp">
      <div className="mp-scan" />
      <div className="mp-wrap">
        <div className="mp-head">
          <div className="mp-mk">C</div>
          <div className="mp-ttl">Bandeja de excepciones<small>conciliación · matching engine</small></div>
          <div style={{ flex: 1 }} />
          <div className="mp-stat"><span className="k">Operador</span><span className="v">{operator}</span></div>
          <div className="mp-stat"><span className="k">Hora local</span><span className="v mono">{clock}</span></div>
          <div style={{ paddingLeft: 14 }}><span className="mp-live"><span className="bd" />En vivo</span></div>
        </div>

        {/* núcleo: total sin resolver */}
        <div className="mp-core" style={{ justifyContent: "center" }}>
          <div className="mp-cap">Sin resolver</div>
          <div className="mp-total" style={{ marginTop: 10 }}>
            <div className="n" style={{ fontSize: 34, color: items.length ? "var(--amber)" : "var(--green)", textShadow: items.length ? "0 0 18px color-mix(in srgb,var(--amber) 45%,transparent)" : "0 0 18px var(--acc-glow)" }}>
              {items.length}
            </div>
            <div className="t">excepciones abiertas</div>
          </div>
          <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 15, color: "var(--ink-2)" }}>{money(total)}</div>
          <div style={{ fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)", fontWeight: 700, marginTop: 2 }}>monto involucrado</div>
          <div className="mp-clock" style={{ gap: 16 }}>
            <div className="b"><div className="n" style={{ fontSize: 16, color: nPend ? "var(--amber)" : "var(--ink-2)" }}>{nPend}</div><div className="t">Sin conciliar</div></div>
            <div className="b"><div className="n" style={{ fontSize: 16, color: nCred ? "var(--cyan)" : "var(--ink-2)" }}>{nCred}</div><div className="t">Créditos</div></div>
            <div className="b"><div className="n" style={{ fontSize: 16, color: nChq ? "var(--red)" : "var(--ink-2)" }}>{nChq}</div><div className="t">Cheques</div></div>
          </div>
          {nCred > 0 && <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--cyan)" }}>{money(montoCred)} <span style={{ color: "var(--dim)" }}>en créditos a favor</span></div>}
          {!canEdit && <div style={{ marginTop: 12, fontSize: 11, color: "var(--dim)" }}>Sólo lectura · resuelve administración</div>}
        </div>

        {/* lista */}
        <div className="mp-box" style={{ gridColumn: "span 8" }}>
          <div className="mp-ph">
            <h3>Excepciones · {items.length}</h3>
            <span className="hint">origen conectado a ventas · caja · cobranzas</span>
          </div>

          {items.length === 0 ? (
            <div className="exc-empty">
              <Icon name="check" size={26} />
              <div className="big">Todo conciliado</div>
              <div style={{ fontSize: 12 }}>No hay pagos sin aplicar, créditos a favor ni cheques rechazados.</div>
            </div>
          ) : (
            <div className="exc-list">
              {items.map((e) => {
                const k = KIND[e.kind];
                const src = SOURCE[e.source] ?? SOURCE.manual;
                const docs = openDocs[e.partyId] ?? [];
                const busy = pending && busyId === e.id;
                return (
                  <div className="exc-row" key={e.kind + e.id}>
                    <span className="exc-dot" style={{ background: k.color, boxShadow: `0 0 9px ${k.color}` }} />
                    <div className="exc-main">
                      <div className="exc-t">
                        {e.party}
                        <span className="exc-kindtag" style={{ background: `color-mix(in srgb, ${k.color} 16%, transparent)`, color: k.color }}>{k.label}</span>
                      </div>
                      <div className="exc-s">
                        {k.hint}
                        {e.sourceRef ? ` · ${e.sourceRef}` : ""}
                        {e.detail ? ` · ${e.detail}` : ""}
                        {" · "}{since(e.date)}
                      </div>
                    </div>
                    <span className="exc-src" style={{ color: src.color, borderColor: `color-mix(in srgb, ${src.color} 35%, transparent)`, background: `color-mix(in srgb, ${src.color} 8%, transparent)` }}>
                      <Icon name={src.icon} size={12} />{src.label}
                    </span>
                    <div className="exc-amt">
                      {money(e.amount)}
                      <span className="u">{e.direction === "cobro" ? "a cobrar" : "a pagar"}</span>
                    </div>
                    {canEdit && (
                      <div className="exc-acts">
                        {e.kind === "pendiente" && (
                          <>
                            <button className="btn btn-primary" disabled={busy} onClick={() => run(e.id, () => retryMatch(e.id), "Conciliación reintentada.")}>
                              <Icon name="refresh" size={13} />{busy ? "…" : "Reintentar"}
                            </button>
                            <button className="btn danger" disabled={busy} onClick={() => run(e.id, () => voidPayment(e.id), "Pago anulado.")}>Anular</button>
                          </>
                        )}
                        {e.kind === "credito" && (
                          <>
                            <button className="btn btn-primary" disabled={busy} onClick={() => { setApplyFor(e); setFlash(null); }}>
                              <Icon name="link" size={13} />Aplicar
                            </button>
                            <button className="btn danger" disabled={busy} onClick={() => run(e.id, () => writeoffCredit(e.id), "Crédito dado de baja.")}>{busy ? "…" : "Baja"}</button>
                          </>
                        )}
                        {e.kind === "cheque" && (
                          <Link className="btn" href="/valores"><Icon name="check" size={13} />Ver en Valores</Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {flash && (
            <div className="note" style={{ margin: 14, ...(flash.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
              <Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* modal aplicar crédito */}
      {applyFor && (
        <div className="mp-modal" onClick={(ev) => { if (ev.target === ev.currentTarget) setApplyFor(null); }}>
          <div className="mp-modal-card" style={{ maxWidth: 460 }}>
            <h3 style={{ fontSize: 15, color: "var(--ink-2)" }}>Aplicar crédito · {applyFor.party}</h3>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Crédito disponible <b style={{ color: "var(--cyan)" }}>{money(applyFor.amount)}</b>. Elegí la factura abierta a la que imputarlo (se aplica el menor entre el crédito y el saldo).
            </p>
            {(openDocs[applyFor.partyId] ?? []).length === 0 ? (
              <div className="note"><Icon name="alert" size={16} /><span>Esta entidad no tiene facturas abiertas. Podés dejar el crédito a cuenta o darlo de baja.</span></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                {(openDocs[applyFor.partyId] ?? []).map((d) => (
                  <div
                    className="exc-doc"
                    key={d.id}
                    onClick={() => { if (!pending) run(applyFor.id, () => applyCreditTo(applyFor.id, d.id, applyFor.amount), `Crédito aplicado a ${d.number || "la factura"}.`); }}
                  >
                    <div>
                      <div className="num">{d.number || "Factura"}</div>
                      <div className="due">{d.due_date ? "Vence " + d.due_date : "Sin vencimiento"}</div>
                    </div>
                    <div className="bd">{money(d.balance_due)}</div>
                  </div>
                ))}
              </div>
            )}
            {flash && !flash.ok && (
              <div className="note" style={{ background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }}>
                <Icon name="alert" size={16} /><span>{flash.text}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setApplyFor(null)}>Cerrar</button>
              <button className="btn danger" disabled={pending} onClick={() => run(applyFor.id, () => writeoffCredit(applyFor.id), "Crédito dado de baja.")}>Dar de baja</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
