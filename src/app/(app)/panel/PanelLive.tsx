"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { setDailyTarget } from "./actions";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

type Gen = { n: string; marcas: number; emoji: string; inicio: number; actual: number };
type St = {
  ventasN: number; ventasMonto: number; objetivo: number;
  efectivo: number; electronico: number; lastMin: number;
  generics: Gen[]; telem: number[];
};
type LogLine = { ts: string; tag: string; msg: string; amt: string; cls: string };

const GEN0: Gen[] = [
  { n: "Yerba", marcas: 5, emoji: "🧉", inicio: 60, actual: 38 },
  { n: "Gaseosas", marcas: 9, emoji: "🥤", inicio: 140, actual: 82 },
  { n: "Lácteos", marcas: 7, emoji: "🥛", inicio: 95, actual: 54 },
  { n: "Fiambres", marcas: 6, emoji: "🧀", inicio: 45, actual: 11 },
  { n: "Limpieza", marcas: 11, emoji: "🧴", inicio: 120, actual: 96 },
  { n: "Cervezas", marcas: 7, emoji: "🍺", inicio: 96, actual: 19 },
];

function spark(color: string) {
  return (
    <svg className="mp-sk" width="80" height="26" viewBox="0 0 72 24" fill="none">
      <polyline points="0,20 12,14 24,17 36,8 48,11 60,4 72,7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
    </svg>
  );
}
const tankColor = (p: number) =>
  p > 0.5 ? "linear-gradient(90deg,#2a9d7a,#39d98a)" : p > 0.25 ? "linear-gradient(90deg,#c98a1e,#f5b23d)" : "linear-gradient(90deg,#c0392b,#ff6b6b)";

export type Venc = { id: string; number: string; party: string; due: string; amount: number; tipo: "pagar" | "cobrar" };
export type MargenHoy = { ventas: number; costo: number; margen: number; pct: number };

const fmtDue = (d: string) => { const [, m, day] = d.split("-"); return day && m ? `${day}/${m}` : d; };
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PanelLive({ orgName, sucursal, operator, objetivo, canEdit, vencimientos, margenHoy }: { orgName: string; sucursal: string; operator: string; objetivo: number; canEdit: boolean; vencimientos: Venc[]; margenHoy: MargenHoy }) {
  const [st, setSt] = useState<St>({
    ventasN: 32, ventasMonto: 184520, objetivo,
    efectivo: 149130, electronico: 55390, lastMin: 0,
    generics: GEN0.map((g) => ({ ...g })),
    telem: Array.from({ length: 32 }, (_, i) => 1500 + Math.round(Math.abs(Math.sin(i / 3)) * 4000)),
  });
  const [clock, setClock] = useState("--:--:--");
  const [jornada, setJornada] = useState("00:00:00");
  const [log, setLog] = useState<LogLine[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [editObj, setEditObj] = useState(false);
  const [objDraft, setObjDraft] = useState(String(objetivo));
  const [dom, setDom] = useState(12);
  const [, startObj] = useTransition();
  const stRef = useRef(st);
  stRef.current = st;

  function saveObjetivo() {
    const v = parseFloat(objDraft.replace(/\./g, "").replace(",", ".")) || 0;
    if (v <= 0) return;
    setSt((prev) => ({ ...prev, objetivo: v }));
    setEditObj(false);
    startObj(async () => { await setDailyTarget(v); });
  }

  // sistema iniciado
  useEffect(() => {
    setLog([
      { ts: "", tag: "SYS", msg: "Conexión con Banco Galicia establecida", amt: "OK", cls: "sys" },
      { ts: "", tag: "SYS", msg: "Caja Centro abierta 08:15 · fondo $ 20.000", amt: "OK", cls: "sys" },
      { ts: "", tag: "SYS", msg: "Sistema iniciado · sincronizando sucursales", amt: "OK", cls: "sys" },
    ]);
  }, []);

  // tick de ventas
  useEffect(() => {
    const id = setInterval(() => {
      const prev = stRef.current;
      const elec = Math.random() < 0.34;
      const amt = 1200 + Math.floor(Math.random() * 13500);
      const generics = prev.generics.map((g) => ({ ...g }));
      const avail = generics.filter((g) => g.actual > 0);
      let name = "varios";
      if (avail.length) {
        const g = avail[Math.floor(Math.random() * avail.length)];
        g.actual = Math.max(0, g.actual - (1 + Math.floor(Math.random() * 2)));
        name = g.n;
      }
      const telem = [...prev.telem, (amt / 1000) * 3 + 800];
      if (telem.length > 32) telem.shift();
      setSt({
        ...prev,
        ventasN: prev.ventasN + 1, ventasMonto: prev.ventasMonto + amt, lastMin: prev.lastMin + amt,
        efectivo: prev.efectivo + (elec ? 0 : amt), electronico: prev.electronico + (elec ? amt : 0),
        generics, telem,
      });
      const ts = new Date().toLocaleTimeString("es-AR", { hour12: false });
      setLog((l) => [
        { ts, tag: elec ? "ELEC" : "EFVO", msg: `Venta #${4820 + prev.ventasN - 31} · ${name} · ${elec ? "medio electrónico" : "efectivo"}`, amt: "+ " + money(amt), cls: elec ? "elec" : "efvo" },
        ...l,
      ].slice(0, 40));
      setFlash(elec ? "valores" : "caja");
      setTimeout(() => setFlash(null), 700);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // reloj + jornada
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("es-AR", { hour12: false }));
      setDom(now.getDate());
      const start = new Date();
      start.setHours(8, 15, 0, 0);
      const s = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
      setJornada(`${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(1, st.ventasMonto / st.objetivo);
  const dash = 477 * (1 - pct);
  const enRojo = st.generics.filter((g) => g.actual / g.inicio < 0.25).length;

  const stations = [
    { key: "caja", href: "/cajas", label: "Cajas del día", light: "green", value: money(st.efectivo), sub: `Electrónico <b>${money(st.electronico)}</b> · ver cajas en vivo`, spark: "#39d98a" },
    { key: "ventas", href: "/ventas", label: "Ventas / POS", light: "green", value: `${st.ventasN} <small>tickets</small>`, sub: `Recaudado <b>${money(st.ventasMonto)}</b>`, spark: "#2fe6c8" },
    { key: "offline", href: "/offline", label: "Ventas offline", light: "amber", value: `Sin conexión`, sub: `cola de ventas <b>a sincronizar</b>`, spark: "#f5a524" },
    { key: "stock", href: "/productos", label: "Stock · Alertas", light: "red", value: "4 <small>críticos</small>", sub: `<b>${enRojo}</b> genéricos en rojo`, spark: "#f5b23d" },
    { key: "servicios", href: "/servicios", label: "Servicios · Adeudado", light: "amber", value: money(60500), sub: "<b>2</b> facturas pendientes", spark: "#49d6c4" },
    { key: "valores", href: "/valores", label: "Por depositar", light: "amber", value: money(121200), sub: "<b>2</b> cheques en cartera", spark: "#57d7ea" },
    { key: "grande", href: "/tesoreria", label: "Tesorería", light: "cyan", value: money(4820000), sub: `Últ. entrada <b>+ ${money(129130)}</b>`, spark: "#2fe6c8" },
  ];

  // flujo de caja del mes (comparativo por día; hoy en vivo)
  const monthFlow = Array.from({ length: dom }, (_, i) =>
    i === dom - 1 ? st.ventasMonto : Math.round(220000 + Math.abs(Math.sin((i + 1) * 1.3)) * 260000),
  );
  const maxFlow = Math.max(...monthFlow, 1);
  const avgFlow = monthFlow.reduce((a, b) => a + b, 0) / monthFlow.length;

  return (
    <div className="mp">
      <div className="mp-scan" />
      <div className="mp-wrap">
        <div className="mp-head">
          <div className="mp-mk">C</div>
          <div className="mp-ttl">{orgName || "Comercia"}<small>Centro de comando</small></div>
          <div style={{ flex: 1 }} />
          <div className="mp-stat"><span className="k">Sucursal</span><span className="v">{sucursal}</span></div>
          <div className="mp-stat"><span className="k">Operador</span><span className="v">{operator}</span></div>
          <div className="mp-stat"><span className="k">Hora local</span><span className="v mono">{clock}</span></div>
          <div style={{ paddingLeft: 14 }}><span className="mp-live"><span className="bd" />En vivo</span></div>
        </div>

        <div className="mp-stations">
          {stations.map((s) => {
            const isVentas = s.key === "ventas";
            // La tarjeta de ventas destella en cada venta (efectivo o electrónico)
            const flashing = flash === s.key || (isVentas && flash !== null);
            return (
              <Link key={s.key} href={s.href} className={"mp-station" + (flashing ? " mp-flash" : "")}>
                <span className="mp-cnr tl" /><span className="mp-cnr br" />
                <div className="mp-lbl">
                  <span className={"mp-light " + s.light} />{s.label}
                  {isVentas && <span className="mp-live" style={{ marginLeft: "auto", padding: "3px 9px", fontSize: 8.5 }}><span className="bd" />Margen en vivo</span>}
                </div>
                <div className="mp-big" dangerouslySetInnerHTML={{ __html: s.value }} />
                <div className="mp-sub" dangerouslySetInnerHTML={{ __html: s.sub }} />
                {isVentas ? (
                  <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--line)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".16em", color: "var(--dim)", textTransform: "uppercase" }}>Margen</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "var(--acc)", textShadow: "0 0 14px var(--acc-glow)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{money(margenHoy.margen)}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{(margenHoy.pct * 100).toFixed(1)}%</span>
                  </div>
                ) : spark(s.spark)}
              </Link>
            );
          })}
        </div>

        <div className="mp-core">
          <div className="mp-cap">Objetivo del día</div>
          <div className="mp-gauge">
            <svg width="184" height="184" viewBox="0 0 184 184">
              <circle cx="92" cy="92" r="76" fill="none" stroke="rgba(64,224,208,.12)" strokeWidth="12" />
              <circle cx="92" cy="92" r="76" fill="none" stroke="url(#gg)" strokeWidth="12" strokeLinecap="round" transform="rotate(-90 92 92)" strokeDasharray="477" strokeDashoffset={dash} style={{ transition: "stroke-dashoffset .6s ease", filter: "drop-shadow(0 0 6px var(--acc-glow))" }} />
              <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#39d98a" /><stop offset="1" stopColor="#2fe6c8" /></linearGradient></defs>
            </svg>
            <div className="mp-pct"><span className="n">{Math.round(pct * 100)}%</span><span className="t">Cumplido</span></div>
          </div>
          <div className="mp-total"><div className="n">{money(st.ventasMonto)}</div><div className="t">Recaudado hoy</div></div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)" }}>
            {editObj ? (
              <>
                <div className="in-field" style={{ padding: "0 8px", width: 130 }}><span>$</span><input value={objDraft} onChange={(e) => setObjDraft(e.target.value)} inputMode="decimal" style={{ fontSize: 13, padding: "5px 0" }} autoFocus /></div>
                <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={saveObjetivo}>OK</button>
                <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setEditObj(false)}>×</button>
              </>
            ) : (
              <>
                <span>Objetivo <b style={{ color: "var(--ink-2)" }}>{money(st.objetivo)}</b></span>
                {canEdit && (
                  <button onClick={() => { setObjDraft(String(st.objetivo)); setEditObj(true); }} style={{ background: "none", border: "1px solid var(--line)", color: "var(--acc)", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✎ editar</button>
                )}
              </>
            )}
          </div>
          <div className="mp-clock">
            <div className="b"><div className="n">{jornada}</div><div className="t">Jornada</div></div>
            <div className="b"><div className="n">{st.ventasN}</div><div className="t">Tickets</div></div>
            <div className="b"><div className="n">{money(st.ventasMonto / st.ventasN)}</div><div className="t">Promedio</div></div>
          </div>
        </div>

        <div className="mp-box mp-tanks">
          <div className="mp-ph"><h3>Stock del día · productos genéricos</h3><span className="hint">nivel = ventas del día</span></div>
          {st.generics.map((g) => {
            const p = g.actual / g.inicio, sold = g.inicio - g.actual;
            return (
              <div key={g.n} className="mp-tank">
                <span className="mp-emo">{g.emoji}</span>
                <div className="mp-tank-meta"><div className="mp-tank-n">{g.n}</div><div className="mp-tank-s">{g.marcas} marcas · abrió con {g.inicio} u.</div></div>
                <div className="mp-gaugebar"><div className="mp-fill" style={{ width: (p * 100).toFixed(1) + "%", background: tankColor(p) }} /><div className="mp-tk" /></div>
                <div className="mp-rd"><div className="u">{g.actual}<span style={{ fontSize: 11, color: "var(--dim)" }}>/{g.inicio}</span></div><div className="d">−{sold} vend.</div></div>
              </div>
            );
          })}
        </div>

        <div className="mp-box mp-telem">
          <div className="mp-ph"><h3>Flujo de caja · mes</h3><span className="hint">todos los días · hoy en vivo</span></div>
          <div className="mp-telemval"><span className="n">{money(st.ventasMonto)}</span><span className="t">hoy · prom {money(avgFlow)}</span></div>
          <div style={{ padding: "6px 12px 14px" }}>
            <div className="cmpchart">
              {monthFlow.map((v, i) => {
                const today = i === dom - 1;
                return (
                  <div key={i} className={"cmpday" + (today ? " today" : "")} title={`Día ${i + 1}: ${money(v)}`}>
                    <div className="cmpbars">
                      <div className="cmpbar" style={{ height: Math.round((v / maxFlow) * 120), background: today ? "var(--acc)" : "#2a9d7a", boxShadow: today ? "0 0 10px var(--acc-glow)" : undefined }} />
                    </div>
                    <div className="cmpd">{today ? "Hoy" : i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mp-box" style={{ gridColumn: "span 12" }}>
          <div className="mp-ph">
            <h3>Vencimientos del mes</h3>
            <span className="hint">
              impagos · a pagar {money(vencimientos.filter((v) => v.tipo === "pagar").reduce((s, v) => s + v.amount, 0))} · a cobrar {money(vencimientos.filter((v) => v.tipo === "cobrar").reduce((s, v) => s + v.amount, 0))}
            </span>
          </div>
          {vencimientos.length === 0 ? (
            <div style={{ padding: "18px 20px", color: "var(--dim)", fontSize: 12.5 }}>Sin vencimientos impagos este mes.</div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: 220 }}>
              <table className="tbl">
                <thead><tr><th>Vence</th><th>Comprobante</th><th>Entidad</th><th>Tipo</th><th className="num">Importe</th></tr></thead>
                <tbody>
                  {vencimientos.map((v) => {
                    const vencida = v.due < todayISO();
                    return (
                      <tr key={v.id}>
                        <td className="tnum" style={{ color: vencida ? "var(--red)" : "var(--ink-2)", fontWeight: vencida ? 700 : 400 }}>
                          {fmtDue(v.due)}{vencida ? " ⚠" : ""}
                        </td>
                        <td className="muted">{v.number}</td>
                        <td style={{ color: "var(--ink-2)" }}>{v.party}</td>
                        <td><span className={"pill " + (v.tipo === "pagar" ? "pill-warn" : "pill-ok")}>{v.tipo === "pagar" ? "A pagar" : "A cobrar"}</span></td>
                        <td className="num tnum" style={{ fontWeight: 600, color: v.tipo === "pagar" ? "var(--amber)" : "var(--green)" }}>{money(v.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mp-box mp-console">
          <div className="mp-ph"><h3>Registro de eventos</h3><span className="hint">actualización automática</span></div>
          <div className="mp-log">
            {log.map((l, i) => (
              <div key={i} className="mp-logline">
                <span className="ts">{l.ts || "—:—:—"}</span>
                <span className={"mp-tag " + l.cls}>{l.tag}</span>
                <span className="msg">{l.msg}</span>
                <span className="amt">{l.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
