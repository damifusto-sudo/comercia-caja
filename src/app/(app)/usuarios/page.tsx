import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: cajas } = await supabase
    .from("cash_registers")
    .select("id, name, username, active, branches(name)")
    .order("name");

  return (
    <>
      <Topbar title="Usuarios y cajas" subtitle="Administración de accesos" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <span className="pill pill-plain"><Icon name="shield" size={13} /> Sólo administrador</span>
          <span className="muted" style={{ fontSize: 12 }}>Cada usuario de caja identifica su caja y sólo accede a la suya.</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary"><Icon name="grid" size={15} /> Crear caja</button>
        </div>
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Caja</th><th>Sucursal</th><th>Usuario (login)</th><th>Estado</th><th style={{ textAlign: "right" }}>Acciones</th></tr></thead>
            <tbody>
              {(cajas ?? []).map((c) => {
                const br = c.branches as unknown as { name: string } | null;
                return (
                  <tr key={c.id}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <span className="prod-ico"><Icon name="cash" size={15} /></span>
                      <div style={{ color: "var(--ink-2)", fontWeight: 600 }}>{c.name}</div>
                    </div></td>
                    <td>{br?.name ?? "—"}</td>
                    <td>{c.username ? <span className="keychip">{c.username}</span> : <span className="muted">sin usuario</span>}</td>
                    <td><span className={"pill " + (c.active ? "pill-ok" : "pill-mute")}>{c.active ? "Activa" : "Inactiva"}</span></td>
                    <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }}>Generar usuario</button>
                      <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }}>Eliminar</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cx-section-h"><h2 className="cx-h2">Roles del sistema</h2></div>
        <div className="duo">
          <div className="card card-pad">
            <h4 style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Icon name="shield" size={14} /> Administrador</h4>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Acceso total: comando, todos los módulos y gestión de cajas y usuarios.</p>
          </div>
          <div className="card card-pad">
            <h4 style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--green)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Icon name="cash" size={14} /> Cajero</h4>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Inicia sesión con el usuario de su caja. <b style={{ color: "var(--ink-2)" }}>Sólo ve su terminal</b>, sin acceso al comando ni a otros módulos.</p>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Organización: <b style={{ color: "var(--ink-2)" }}>{ctx.orgName}</b></p>
      </div>
    </>
  );
}
