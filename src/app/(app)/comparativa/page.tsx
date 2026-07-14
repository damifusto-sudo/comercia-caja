import Topbar from "@/components/Topbar";
import { cmpCajas, cmpDays, money } from "@/lib/seed";

export default function ComparativaPage() {
  // historia determinística por caja + hoy
  const hist = cmpCajas.map((c, ci) => {
    const arr: number[] = [];
    for (let d = 1; d < cmpDays; d++) arr.push(Math.round(90000 + ci * 24000 + Math.abs(Math.sin(d * 1.2 + ci * 1.7)) * 72000));
    arr.push(c.today);
    return arr;
  });
  const max = Math.max(1, ...hist.flat());
  const totToday = cmpCajas.reduce((s, c) => s + c.today, 0) || 1;

  return (
    <>
      <Topbar title="Comparativa de cajas" subtitle="Mensual" />
      <div className="cx-view">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12 }}>Comparación diaria de las cajas durante el mes. La columna <b style={{ color: "var(--ink-2)" }}>Hoy</b> refleja las ventas del día.</span>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700 }}>Julio 2026</span>
        </div>
        <div className="card">
          <div className="cx-panel-h"><h3>Ventas por día · comparativa de cajas</h3>
            <span className="legend">{cmpCajas.map((c) => (<span key={c.id} style={{ marginLeft: 14 }}><i style={{ background: c.color }} />{c.name}</span>))}</span>
          </div>
          <div style={{ padding: "18px 18px 14px" }}>
            <div className="cmpchart">
              {Array.from({ length: cmpDays }).map((_, di) => {
                const today = di === cmpDays - 1;
                return (
                  <div key={di} className={"cmpday" + (today ? " today" : "")}>
                    <div className="cmpbars">
                      {cmpCajas.map((c, ci) => (
                        <div key={c.id} className="cmpbar" title={`${c.name}: ${money(hist[ci][di])}`} style={{ height: Math.round((hist[ci][di] / max) * 130), background: c.color }} />
                      ))}
                    </div>
                    <div className="cmpd">{today ? "Hoy" : di + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="cx-section-h"><h2 className="cx-h2">Resumen del mes por caja</h2></div>
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Caja</th><th className="num">Ventas hoy</th><th className="num">Prom. día</th><th className="num">Mes acumulado</th><th className="num">Participación hoy</th></tr></thead>
            <tbody>
              {cmpCajas.map((c, ci) => {
                const mes = hist[ci].reduce((s, v) => s + v, 0);
                return (
                  <tr key={c.id}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 11 }}><span className="avat" style={{ background: c.color }}>{c.id.slice(0, 2)}</span><div><div style={{ color: "var(--ink-2)", fontWeight: 600 }}>{c.name}</div><div className="muted" style={{ fontSize: 11 }}>{c.suc}</div></div></div></td>
                    <td className="num tnum" style={{ color: "var(--ink-2)", fontWeight: 600 }}>{money(c.today)}</td>
                    <td className="num tnum">{money(Math.round(mes / cmpDays))}</td>
                    <td className="num tnum">{money(mes)}</td>
                    <td className="num tnum" style={{ color: "var(--acc)" }}>{Math.round((c.today / totToday) * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
