"use client";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";
import { createSale } from "../ventas/actions";
import { getQueue, removeSale, updateSale, type OfflineSale } from "@/lib/offlineSales";

const fmtTime = (t: number) => new Date(t).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function OfflineClient() {
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => { setSales(await getQueue()); setLoaded(true); }, []);

  useEffect(() => {
    void reload();
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [reload]);

  async function syncOne(s: OfflineSale): Promise<boolean> {
    try {
      const res = await createSale({ branchId: s.branchId, method: "efectivo", lines: s.lines, partyId: null, ref: s.ref, clientUid: s.uid });
      if (res.ok) { await removeSale(s.uid); return true; }
      await updateSale({ ...s, status: "error", error: res.error ?? "Rechazada" });
      return false;
    } catch {
      // sin conexión / error de red: se deja pendiente para reintentar
      return false;
    }
  }

  async function retry(s: OfflineSale) {
    setBusy(true); setFlash(null);
    const ok = await syncOne(s);
    await reload();
    setBusy(false);
    setFlash(ok ? { ok: true, text: `Venta registrada (${s.ref}) ✓` } : { ok: false, text: `No se pudo registrar ${s.ref}. Revisá la conexión o el detalle.` });
  }

  async function syncAll() {
    if (typeof navigator !== "undefined" && !navigator.onLine) { setFlash({ ok: false, text: "Sin conexión: no se puede sincronizar todavía." }); return; }
    setBusy(true); setFlash(null);
    const q = (await getQueue()).filter((s) => s.status === "pendiente");
    let done = 0, failed = 0;
    for (const s of q) {
      const ok = await syncOne(s);
      if (ok) done++; else { failed++; if (typeof navigator !== "undefined" && !navigator.onLine) break; }
    }
    await reload();
    setBusy(false);
    setFlash({ ok: failed === 0, text: `Sincronización: ${done} registrada(s)${failed ? ` · ${failed} sin registrar (revisá)` : ""}.` });
  }

  async function discard(s: OfflineSale) {
    if (!window.confirm(`¿Descartar la venta ${s.ref} por ${money(s.total)}? No se va a registrar. Usalo sólo si ya la resolviste por otro medio.`)) return;
    await removeSale(s.uid);
    await reload();
    setFlash({ ok: true, text: `Venta ${s.ref} descartada de la cola.` });
  }

  const pendientes = sales.filter((s) => s.status === "pendiente");
  const conError = sales.filter((s) => s.status === "error");
  const totalCola = sales.reduce((a, s) => a + s.total, 0);

  return (
    <>
      <Topbar title="Ventas offline" subtitle="Ventas cobradas sin conexión · pendientes de registrar" />
      <div className="cx-view">
        {/* Estado + resumen */}
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 15 }}>
          <span className={"pill " + (online ? "pill-ok" : "pill-warn")}>{online ? "● En línea" : "● Sin conexión"}</span>
          <div className="muted" style={{ fontSize: 13 }}>
            {sales.length === 0 ? "No hay ventas offline en este dispositivo." : `${pendientes.length} pendiente(s)${conError.length ? ` · ${conError.length} con error` : ""} · ${money(totalCola)} en cola`}
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={syncAll} disabled={busy || pendientes.length === 0 || !online}>
            <Icon name="check" size={15} /> {busy ? "Sincronizando…" : "Sincronizar todo"}
          </button>
        </div>

        {flash && (
          <div className="note" style={{ marginBottom: 12, ...(flash.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
            <Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span>
          </div>
        )}

        {!online && (
          <div className="note" style={{ marginBottom: 12, background: "color-mix(in srgb,var(--amber) 12%,transparent)", color: "var(--amber)", borderColor: "color-mix(in srgb,var(--amber) 30%,transparent)" }}>
            <Icon name="alert" size={16} /><span>Estás sin internet. Las ventas quedan guardadas acá y se registran solas cuando vuelva la conexión.</span>
          </div>
        )}

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Ticket</th><th className="num">Importe</th><th>Estado</th><th>Detalle</th><th></th></tr></thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>Cargando…</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>No hay ventas offline pendientes. Todo registrado ✓</td></tr>
              ) : [...sales].sort((a, b) => a.createdAt - b.createdAt).map((s) => (
                <tr key={s.uid}>
                  <td className="tnum muted" style={{ fontSize: 12 }}>{fmtTime(s.createdAt)}</td>
                  <td style={{ color: "var(--ink-2)" }}>{s.ref}</td>
                  <td className="num tnum">{money(s.total)}</td>
                  <td><span className={"pill " + (s.status === "error" ? "pill-bad" : "pill-warn")}>{s.status === "error" ? "Con error" : "Pendiente"}</span></td>
                  <td className="muted" style={{ fontSize: 11.5, maxWidth: 260 }}>{s.error ?? `${s.lines.length} ítem(es), efectivo`}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn" style={{ padding: "4px 10px" }} onClick={() => retry(s)} disabled={busy || !online} title={online ? "Reintentar" : "Sin conexión"}>Reintentar</button>
                    <button className="btn" style={{ padding: "4px 10px", marginLeft: 6, color: "var(--red)" }} onClick={() => discard(s)} disabled={busy}>Descartar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
          Estas ventas están guardadas en <b>este dispositivo</b>. Al registrarse obtienen su número (y CAE si hay AFIP). El registro no duplica aunque reintentes: cada venta lleva un identificador único.
        </div>
      </div>
    </>
  );
}
