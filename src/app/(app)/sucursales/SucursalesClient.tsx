"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { createBranch, updateBranch, toggleBranch } from "./actions";

export type Sucursal = { id: string; name: string; address: string; active: boolean; cajas: number };

export default function SucursalesClient({ sucursales, canEdit }: { sucursales: Sucursal[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function openNew() { setEditing("new"); setName(""); setAddress(""); setMsg(null); }
  function openEdit(s: Sucursal) { setEditing(s.id); setName(s.name); setAddress(s.address); setMsg(null); }

  function save() {
    setMsg(null);
    start(async () => {
      const res = editing === "new" ? await createBranch(name, address) : await updateBranch(editing as string, name, address);
      if (res.ok) { setEditing(null); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "No se pudo guardar." });
    });
  }

  function toggle(s: Sucursal) {
    start(async () => {
      const res = await toggleBranch(s.id, !s.active);
      if (res.ok) router.refresh();
      else setMsg({ ok: false, text: res.error ?? "No se pudo actualizar." });
    });
  }

  return (
    <>
      <Topbar title="Sucursales" subtitle={`${sucursales.filter((s) => s.active).length} activas de ${sucursales.length}`} />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12 }}>Cada sucursal tiene su propio stock, cajas y movimientos. El stock y las órdenes de compra entran a la sucursal de destino.</span>
          <div style={{ flex: 1 }} />
          {canEdit && <button className="btn btn-primary" onClick={openNew}><Icon name="factory" size={15} /> Nueva sucursal</button>}
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Sucursal</th><th>Dirección</th><th className="num">Cajas</th><th>Estado</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {sucursales.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 22 }}>Todavía no hay sucursales.</td></tr>
              ) : sucursales.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: "var(--ink-2)" }}>{s.name}</td>
                  <td className="muted">{s.address || "—"}</td>
                  <td className="num tnum">{s.cajas}</td>
                  <td><span className={"pill " + (s.active ? "pill-ok" : "pill-mute")}>{s.active ? "Activa" : "Inactiva"}</span></td>
                  {canEdit && (
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openEdit(s)} disabled={pending}>Editar</button>
                        <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggle(s)} disabled={pending}>{s.active ? "Desactivar" : "Activar"}</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && !msg.ok && <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{msg.text}</div>}
      </div>

      {editing && (
        <div className="mp-modal" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="mp-modal-card">
            <h3 style={{ fontSize: 15, color: "var(--ink-2)" }}>{editing === "new" ? "Nueva sucursal" : "Editar sucursal"}</h3>
            <div className="field"><label>Nombre</label><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sucursal Norte" /></div>
            <div className="field"><label>Dirección</label><input className="inp" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Opcional" /></div>
            {msg && !msg.ok && <div style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{msg.text}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
