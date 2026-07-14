import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { PLANS, money } from "./suscripcion/plans";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "cart", t: "Ventas / POS", d: "Punto de venta rápido con balanza y lector de código de barras. Todos los medios de pago." },
  { icon: "cash", t: "Caja diaria", d: "Cobrás en efectivo, tarjeta y QR. Arqueo del día y control de la caja al instante." },
  { icon: "box", t: "Productos y stock", d: "Catálogo con precio por etiqueta de margen, stock en vivo y alertas de reposición." },
  { icon: "receipt", t: "Ticket térmico", d: "Impresión directa por impresora térmica (ESC/POS), con QR fiscal si lo necesitás." },
  { icon: "refresh", t: "Modo offline", d: "Si se cae internet, la caja sigue cobrando y sincroniza sola al volver la conexión." },
  { icon: "check", t: "Simple y blindado", d: "El precio lo pone el sistema, el stock se descuenta solo: menos errores en el mostrador." },
];

export default async function Landing() {
  // Si ya inició sesión, va directo a su comercio.
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/caja");
  } catch { /* sin sesión / sin conexión → mostramos la landing */ }

  return (
    <main className="lp">
      <header className="lp-nav">
        <div className="lp-logo"><span className="lp-mk">C</span> Comercia Caja</div>
        <div style={{ flex: 1 }} />
        <Link className="btn" href="/login">Iniciar sesión</Link>
        <Link className="btn btn-primary" href="/signup">Crear comercio gratis</Link>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <span className="lp-badge"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--acc)", boxShadow: "0 0 8px var(--acc)" }} />48 hs de prueba · sin tarjeta</span>
        <h1 className="lp-h1">Tu <span className="g">punto de venta</span>, rápido y sin errores.</h1>
        <p className="lp-sub">Caja, ventas con balanza y código de barras, y control de stock — lo justo para vender en el mostrador, en tiempo real y hasta sin internet.</p>
        <div className="lp-cta">
          <Link className="btn btn-primary lp-btn-lg" href="/signup"><Icon name="grid" size={17} /> Empezar gratis</Link>
          <Link className="btn lp-btn-lg" href="/login">Ya tengo cuenta</Link>
        </div>
        <div className="lp-trust">Multi-sucursal · datos aislados y seguros · pensado para comercios de Argentina</div>
      </section>

      {/* Features */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-eyebrow">Solo mostrador</div>
          <h2 className="lp-sec-t">Lo que necesitás para vender, nada más</h2>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <div className="lp-feat" key={f.t}>
                <div className="ic"><Icon name={f.icon} size={20} /></div>
                <h4>{f.t}</h4>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-eyebrow">Precios simples</div>
          <h2 className="lp-sec-t">Elegí tu plan mensual</h2>
          <div className="lp-plans">
            {Object.entries(PLANS).map(([key, p]) => (
              <div key={key} className={"lp-plan" + (key === "pro" ? " hot" : "")}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 17, color: "var(--ink-2)" }}>{p.label}</h3>
                  {key === "pro" && <span className="pill pill-plain">Recomendado</span>}
                </div>
                <div className="lp-price">{money(p.amount)}<span style={{ fontSize: 13, color: "var(--dim)", fontFamily: "var(--sans)" }}> /mes</span></div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.features.map((f) => <li key={f} style={{ fontSize: 13, color: "var(--ink)" }}>✓ {f}</li>)}
                </ul>
                <Link className="btn btn-primary" href="/signup" style={{ marginTop: "auto" }}>Empezar con {p.label}</Link>
              </div>
            ))}
          </div>
          <p className="lp-trust" style={{ textAlign: "center" }}>Probás 48 hs gratis. Después, el plan se cobra por Mercado Pago y podés cancelar cuando quieras.</p>
        </div>
      </section>

      {/* CTA final */}
      <section className="lp-sec" style={{ textAlign: "center" }}>
        <h2 className="lp-sec-t" style={{ maxWidth: "22ch", margin: "0 auto" }}>Poné a tu comercio en control hoy mismo</h2>
        <div className="lp-cta"><Link className="btn btn-primary lp-btn-lg" href="/signup"><Icon name="grid" size={17} /> Crear mi comercio gratis</Link></div>
      </section>

      <footer className="lp-foot">Comercia Caja · punto de venta para comercios de Argentina · <Link href="/login" style={{ color: "var(--acc)" }}>Iniciar sesión</Link></footer>
    </main>
  );
}
