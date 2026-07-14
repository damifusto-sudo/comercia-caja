"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Email sintético para el login de cajero: el usuario identifica su caja. */
function cajaEmail(username: string) {
  return `${username.trim().toLowerCase()}@caja.comercia.local`;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"admin" | "caja">("admin");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [user, setUser] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const creds =
        mode === "admin"
          ? { email: email.trim(), password: pass }
          : { email: cajaEmail(user), password: pin };
      const { error } = await supabase.auth.signInWithPassword(creds);
      if (error) {
        setErr(
          mode === "caja"
            ? "Usuario de caja o PIN incorrecto."
            : "Email o contraseña incorrectos.",
        );
        return;
      }
      // Ruteo por rol: el cajero va directo a su caja; el admin al panel.
      const { data: m } = await supabase
        .from("memberships")
        .select("role")
        .limit(1)
        .maybeSingle();
      router.replace("/caja");
      router.refresh();
    } catch {
      setErr("No se pudo conectar. Verificá la configuración de Supabase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <form
        onSubmit={submit}
        className="card"
        style={{
          width: "100%",
          maxWidth: 390,
          padding: "26px 26px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 13,
          background: "var(--panel-2)",
          borderColor: "var(--acc-line)",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(150deg,var(--acc),#1f66b8)",
              color: "#022",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 19,
              boxShadow: "0 0 20px var(--acc-glow)",
            }}
          >
            C
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--ink-2)", lineHeight: 1.1 }}>
            Comercia Caja
            <small
              style={{
                display: "block",
                fontSize: 9,
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: "var(--dim)",
                fontWeight: 700,
              }}
            >
              Punto de venta
            </small>
          </div>
        </div>

        <h2 style={{ fontSize: 15, color: "var(--ink-2)", margin: "6px 0 2px" }}>
          Iniciar sesión
        </h2>

        <div className="seg" style={{ width: "100%" }}>
          <button
            type="button"
            className={mode === "admin" ? "on" : ""}
            style={{ flex: 1 }}
            onClick={() => {
              setMode("admin");
              setErr(null);
            }}
          >
            Administrador
          </button>
          <button
            type="button"
            className={mode === "caja" ? "on" : ""}
            style={{ flex: 1 }}
            onClick={() => {
              setMode("caja");
              setErr(null);
            }}
          >
            Caja
          </button>
        </div>

        {mode === "admin" ? (
          <>
            <div className="field">
              <label>Email</label>
              <input
                className="inp"
                type="email"
                autoComplete="username"
                placeholder="admin@tucomercio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                className="inp"
                type="password"
                autoComplete="current-password"
                placeholder="••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Acceso total: comando, todos los módulos y gestión de cajas y usuarios.
            </p>
          </>
        ) : (
          <>
            <div className="field">
              <label>Usuario de tu caja</label>
              <input
                className="inp"
                placeholder="ej: caja1"
                autoComplete="off"
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>
            <div className="field">
              <label>PIN</label>
              <input
                className="inp"
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Tu usuario identifica tu caja. Solo accedés a la tuya.
            </p>
          </>
        )}

        {err && (
          <div style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{err}</div>
        )}

        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
