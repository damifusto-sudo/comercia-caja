"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { createCajaConCajero, setCajaActive } from "./actions";

export type CajaRow = { id: string; name: string; username: string | null; active: boolean; branch: string | null };

export default function UsuariosClient({ cajas, orgName }: { cajas: CajaRow[]; orgName: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const flashStyle = (ok: boolean) => ok
    ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" }
    : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" };

  function crear() {
    setFlash(null);
    start(async () => {
      const res = await createCajaConCajero({ cajaName: name, username, pin });
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo crear." }); return; }
      setFlash({ ok: true, text: `Caja "${name}" creada ✓ — el cajero entra con usuario ${res.username} y su PIN.` });
      setName(""); setUsername(""); setPin(""); setOpen(false);
      router.refresh();
    });
  }

  function toggle(c: CajaRow) {
    start(async () => {
      const res = await setCajaActive(c.id, !c.active);
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo cambiar." }); return; }
      router.refresh();
    });
  }

  return (
    <>
      <Topbar title="Usuarios y cajas" subtitle="Alta de cajas y cajeros" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <span className="pill pill-plain"><Icon name="shield" size={13} /> Sólo administrador</span>
          <span className="muted" style={{ fontSize: 12 }}>Cada caja tiene su usuario; el cajero sólo accede a la suya.</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => { setOpen((o) => !o); setFlash(null); }}>
            <Icon name="cash" size={15} /> {open ? "Cerrar" : "Nueva caja + cajero"}
          </button>
        </div>

        {flash && <div className="note" style={{ marginBottom: 14, ...flashStyle(flash.ok) }}><Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span></div>}

        {open && (
          <div className="card card-pad" style={{ marginBottom: 16, borderColor: "var(--acc-line)" }}>
            <div className="cx-panel-h" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 14 }}>Nueva caja y su cajero</h3></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr .8fr auto", gap: 12, alignItems: "end" }}>
              <div className="field"><label>Nombre de la caja</label><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Caja 2 / Mostrador fondo" /></div>
              <div className="field"><label>Usuario (login del cajero)</label><input className="inp" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="ej: caja2" autoComplete="off" /></div>
              <div className="field"><label>PIN</label><input className="inp" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4+ dígitos" inputMode="numeric" autoComplete="new-password" /></div>
              <button className="btn btn-primary" onClick={crear} disabled={busy} style={{ height: 40 }}>{busy ? "Creando…" : "Crear"}</button>
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
              <Icon name="alert" size={13} /> El cajero inicia sesión en modo <b>Caja</b> con el usuario y el PIN. Necesita la clave de servidor (SUPABASE_SERVICE_ROLE_KEY) configurada.
            </p>
          </div>
        )}

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Caja</th><th>Sucursal</th><th>Usuario (login)</th><th>Estado</th><th style={{ textAlign: "right" }}>Acciones</th></tr></thead>
            <tbody>
              {cajas.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>Todavía no hay cajas. Creá la primera.</td></tr>
              ) : cajas.map((c) => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 11 }}><span className="prod-ico"><Icon name="cash" size={15} /></span><div style={{ color: "var(--ink-2)", fontWeight: 600 }}>{c.name}</div></div></td>
                  <td>{c.branch ?? "—"}</td>
                  <td>{c.username ? <span className="keychip">{c.username}</span> : <span className="muted">sin usuario</span>}</td>
                  <td><span className={"pill " + (c.active ? "pill-ok" : "pill-mute")}>{c.active ? "Activa" : "Inactiva"}</span></td>
                  <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggle(c)} disabled={busy}>{c.active ? "Desactivar" : "Activar"}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="duo" style={{ marginTop: 15 }}>
          <div className="card card-pad">
            <h4 style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Icon name="shield" size={14} /> Administrador</h4>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Acceso total: ventas, productos, cajas y usuarios.</p>
          </div>
          <div className="card card-pad">
            <h4 style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--green)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Icon name="cash" size={14} /> Cajero</h4>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Inicia sesión con el usuario de su caja. <b style={{ color: "var(--ink-2)" }}>Sólo ve su terminal</b>.</p>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Organización: <b style={{ color: "var(--ink-2)" }}>{orgName}</b></p>
      </div>
    </>
  );
}
