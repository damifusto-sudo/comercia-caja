"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { crearSuscripcionMP } from "./actions";
import { PLANS, money } from "./plans";

type Sub = { plan: string; status: string; trial_ends_at: string | null; current_period_end: string | null } | null;

const STATUS: Record<string, { label: string; cls: string }> = {
  trial: { label: "Prueba gratis", cls: "pill-plain" },
  active: { label: "Activa", cls: "pill-ok" },
  past_due: { label: "Pago pendiente", cls: "pill-warn" },
  canceled: { label: "Cancelada", cls: "pill-bad" },
};

export default function SuscripcionClient({ sub, canManage, orgName, hasOrg }: { sub: Sub; canManage: boolean; orgName: string; hasOrg: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const st = sub ? STATUS[sub.status] ?? STATUS.trial : null;
  const trialLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 3600000))
    : null;

  async function suscribir(plan: string) {
    setErr(null); setBusy(plan);
    const res = await crearSuscripcionMP(plan);
    setBusy(null);
    if (res.ok && res.url) { window.location.href = res.url; return; }
    setErr(res.error ?? "No se pudo iniciar la suscripción.");
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(150deg,var(--acc),#0c8f7f)", color: "#022", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, boxShadow: "0 0 20px var(--acc-glow)" }}>C</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ink-2)" }}>Suscripción · {orgName || "tu comercio"}</div>
            {st && <span className={"pill " + st.cls} style={{ marginTop: 4 }}>{st.label}{sub?.status === "trial" && trialLeft !== null ? ` · ${trialLeft} hs` : ""}</span>}
          </div>
          <button className="btn" onClick={logout}>Cerrar sesión</button>
        </div>

        {!hasOrg ? (
          <div className="card card-pad">Tu cuenta todavía no tiene un comercio asociado. Cerrá sesión y completá el alta desde <b>Crear mi comercio</b>.</div>
        ) : (
          <>
            {sub?.status !== "active" && (
              <div className="note" style={{ background: "color-mix(in srgb,var(--amber) 12%,transparent)", color: "var(--amber)", borderColor: "color-mix(in srgb,var(--amber) 30%,transparent)" }}>
                {sub?.status === "trial"
                  ? `Estás en período de prueba${trialLeft !== null ? ` (${trialLeft} hs restantes)` : ""}. Elegí un plan para seguir usando Comercia sin interrupciones.`
                  : "Tu comercio no tiene una suscripción activa. Elegí un plan para reactivar el acceso."}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {Object.entries(PLANS).map(([key, p]) => (
                <div key={key} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, borderColor: key === "pro" ? "var(--acc-line)" : undefined }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: 16, color: "var(--ink-2)" }}>{p.label}</h3>
                    {key === "pro" && <span className="pill pill-plain">Recomendado</span>}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 750, color: "var(--acc)" }}>{money(p.amount)}<span style={{ fontSize: 13, color: "var(--dim)" }}> /mes</span></div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                    {p.features.map((f) => <li key={f} style={{ fontSize: 12.5, color: "var(--ink)" }}>✓ {f}</li>)}
                  </ul>
                  <button className="btn btn-primary" style={{ marginTop: "auto" }} disabled={!canManage || busy !== null} onClick={() => suscribir(key)}>
                    {busy === key ? "Redirigiendo a Mercado Pago…" : sub?.status === "active" && sub?.plan === key ? "Plan actual" : "Suscribirme"}
                  </button>
                </div>
              ))}
            </div>

            {!canManage && <p className="muted" style={{ fontSize: 12 }}>Sólo el titular del comercio puede gestionar la suscripción.</p>}
            {err && <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 600 }}>{err}</div>}
            <p className="muted" style={{ fontSize: 11.5 }}>El cobro se procesa por Mercado Pago (suscripción mensual). Podés cancelar cuando quieras desde tu cuenta de Mercado Pago.</p>
          </>
        )}
      </div>
    </main>
  );
}
