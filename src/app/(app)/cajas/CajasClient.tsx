"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";

export type CajaRow = {
  caja: string;
  sucursal: string;
  operador: string;
  tickets: number;
  total: number;
  desde: string | null;
  hasta: string | null;
  estado: "en_vivo" | "cerrada" | "sin_actividad";
};

const EST = {
  en_vivo: { label: "En vivo", color: "var(--green)", pill: "pill-ok" },
  cerrada: { label: "Cerrada", color: "var(--amber)", pill: "pill-warn" },
  sin_actividad: { label: "Sin abrir hoy", color: "var(--dim)", pill: "pill-mute" },
} as const;

export default function CajasClient({ cajas }: { cajas: CajaRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [tick, setTick] = useState(0);

  // Refresco automático (para el "en vivo") cada 15 s
  useEffect(() => {
    const id = setInterval(() => { start(() => router.refresh()); setTick((t) => t + 1); }, 15000);
    return () => clearInterval(id);
  }, [router]);

  const abiertas = cajas.filter((c) => c.estado === "en_vivo").length;
  const totalDia = cajas.reduce((s, c) => s + Number(c.total), 0);

  return (
    <>
      <Topbar title="Cajas del día" subtitle="Todas las cajas · estado en vivo" />
      <div className="cx-view">
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 15 }}>
          <span className="mp-live"><span className="bd" />En vivo</span>
          <div className="muted" style={{ fontSize: 13 }}>
            {abiertas} caja(s) operando · {cajas.length} en total · vendido hoy <b style={{ color: "var(--ink-2)" }}>{money(totalDia)}</b>
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => start(() => router.refresh())} title="Actualizar ahora">
            <Icon name="check" size={15} /> Actualizar
          </button>
        </div>

        {cajas.length === 0 ? (
          <div className="card card-pad muted">No hay cajas configuradas. Cargalas en <b>Usuarios y cajas</b>.</div>
        ) : (
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
            {cajas.map((c) => {
              const e = EST[c.estado];
              return (
                <div key={c.caja} className="card card-pad" style={{ borderColor: c.estado === "en_vivo" ? "var(--acc-line)" : "var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: e.color, boxShadow: c.estado === "en_vivo" ? "0 0 8px var(--green)" : "none", flexShrink: 0 }} />
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.caja}</div>
                    <span style={{ flex: 1 }} />
                    <span className={"pill " + e.pill}>{e.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
                    <Icon name="shield" size={14} /> {c.operador}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{c.sucursal}</div>

                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, fontFamily: "var(--mono)" }}>Horario</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {c.desde ? `${c.desde} – ${c.hasta}${c.estado === "en_vivo" ? " · ahora" : ""}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, fontFamily: "var(--mono)" }}>Tickets</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.tickets}</div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, fontFamily: "var(--mono)" }}>Vendido</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{money(Number(c.total))}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
          El horario y el estado se derivan de la actividad real de cada caja (primera y última venta del día). Se actualiza solo cada 15 segundos.
        </div>
      </div>
    </>
  );
}
