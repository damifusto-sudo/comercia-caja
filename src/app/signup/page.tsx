"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [negocio, setNegocio] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!negocio.trim()) { setErr("Ingresá el nombre de tu comercio."); return; }
    if (pass.length < 6) { setErr("La contraseña debe tener al menos 6 caracteres."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      // Guardamos negocio/nombre en el metadata: si hay confirmación de email,
      // el alta se completa después en /onboarding con estos datos ya cargados.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { org_name: negocio.trim(), full_name: nombre.trim() } },
      });
      if (error) { setErr(error.message.includes("already") ? "Ese email ya está registrado. Iniciá sesión." : error.message); return; }

      // Si Supabase exige confirmación por email, no hay sesión todavía.
      if (!data.session) {
        setInfo("Te enviamos un email para confirmar tu cuenta. Confirmalo e iniciá sesión: vas a terminar el alta en un paso.");
        return;
      }

      const { error: rpcErr } = await supabase.rpc("create_organization", {
        p_org_name: negocio.trim(),
        p_full_name: nombre.trim() || null,
        p_branch_name: "Casa central",
      });
      // Si falla la creación, el layout te lleva a /onboarding para reintentar (no quedás huérfano).
      router.replace(rpcErr ? "/onboarding" : "/ventas");
      router.refresh();
    } catch {
      setErr("No se pudo completar el registro. Reintentá en unos segundos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 400, padding: "26px 26px 22px", display: "flex", flexDirection: "column", gap: 12, background: "var(--panel-2)", borderColor: "var(--acc-line)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(150deg,var(--acc),#1f66b8)", color: "#022", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19, boxShadow: "0 0 20px var(--acc-glow)" }}>C</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--ink-2)", lineHeight: 1.1 }}>
            Comercia Caja
            <small style={{ display: "block", fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase", color: "var(--dim)", fontWeight: 700 }}>Creá tu comercio</small>
          </div>
        </div>

        <h2 style={{ fontSize: 15, color: "var(--ink-2)", margin: "6px 0 0" }}>Empezá gratis</h2>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>48 hs de prueba, sin tarjeta. Después elegís tu plan mensual.</p>

        <div className="field"><label>Nombre del comercio</label>
          <input className="inp" placeholder="Ej: Almacén Don José" value={negocio} onChange={(e) => setNegocio(e.target.value)} />
        </div>
        <div className="field"><label>Tu nombre</label>
          <input className="inp" placeholder="Ej: José Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field"><label>Email</label>
          <input className="inp" type="email" autoComplete="username" placeholder="vos@tucomercio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field"><label>Contraseña</label>
          <input className="inp" type="password" autoComplete="new-password" placeholder="mínimo 6 caracteres" value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>

        {err && <div style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{err}</div>}
        {info && <div style={{ color: "var(--green)", fontSize: 12, fontWeight: 600 }}>{info}</div>}

        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? "Creando tu comercio…" : "Crear mi comercio"}</button>
        <p className="muted" style={{ fontSize: 12, margin: 0, textAlign: "center" }}>
          ¿Ya tenés cuenta? <Link href="/login" style={{ color: "var(--acc)" }}>Iniciá sesión</Link>
        </p>
      </form>
    </main>
  );
}
