// Estado de carga instantáneo para CUALQUIER pantalla de la app: al tocar un
// enlace/tarjeta se ve de inmediato este esqueleto mientras el servidor arma la
// página (en vez de un "clic sin respuesta"). Next lo muestra automáticamente.
export default function Loading() {
  return (
    <div style={{ padding: "26px 24px" }}>
      <div className="sk-line" style={{ width: 240, height: 24, marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginBottom: 18 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="sk-card" style={{ height: 88 }} />)}
      </div>
      <div className="sk-card" style={{ height: 260 }} />
    </div>
  );
}
