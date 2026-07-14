"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingClient({ defaultOrg, defaultName }: { defaultOrg: string; defaultName: string }) {
  const router = useRouter();
  const [negocio, setNegocio] = useState(defaultOrg);
  const [nombre, setNombre] = useState(defaultName);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!negocio.trim()) { setErr("Ingresá el nombre de tu comercio."); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization", {
      p_org_name: negocio.trim(),
      p_full_name: nombre.trim() || null,
      p_branch_name: "Casa central",
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.replace("/ventas");
    router.refresh();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={crear} className="card" style={{ width: "100%", maxWidth: 400, padding: "26px 26px 22px", display: "flex", flexDirection: "column", gap: 12, background: "var(--panel-2)", borderColor: "var(--acc-line)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(150deg,var(--acc),#1f66b8)", color: "#022", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19, boxShadow: "0 0 20px var(--acc-glow)" }}>C</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--ink-2)", lineHeight: 1.1 }}>
            Comercia Caja<small style={{ display: "block", fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase", color: "var(--dim)", fontWeight: 700 }}>Completá el alta</small>
          </div>
        </div>
        <h2 style={{ fontSize: 15, color: "var(--ink-2)", margin: "6px 0 0" }}>Creá tu comercio</h2>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>Tu cuenta está lista. Falta un paso: darle nombre a tu comercio para empezar (48 hs de prueba).</p>
        <div className="field"><label>Nombre del comercio</label>
          <input className="inp" value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Ej: Almacén Don José" />
        </div>
        <div className="field"><label>Tu nombre</label>
          <input className="inp" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: José Pérez" />
        </div>
        {err && <div style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{err}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? "Creando…" : "Crear mi comercio"}</button>
        <button type="button" className="btn" onClick={logout}>Cerrar sesión</button>
      </form>
    </main>
  );
}
