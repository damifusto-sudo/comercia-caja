"use client";

import { useRef, useState, useTransition } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";
import { saveCommerce } from "./actions";

export type CommerceForm = {
  name: string;
  legalName: string;
  taxId: string;
  taxCondition: "responsable_inscripto" | "monotributo" | "exento" | "consumidor_final";
  address: string;
  grossIncome: string;
  activityStart: string;
  logo: string | null;
};

const CONDICIONES: { v: CommerceForm["taxCondition"]; l: string }[] = [
  { v: "responsable_inscripto", l: "Responsable Inscripto" },
  { v: "monotributo", l: "Monotributo" },
  { v: "exento", l: "Exento" },
  { v: "consumidor_final", l: "Consumidor Final" },
];

// Reescala la imagen a máx 360px de ancho y la devuelve como data URL liviano.
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        const maxW = 360;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas no disponible")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ComercioClient({ initial, canEdit }: { initial: CommerceForm; canEdit: boolean }) {
  const [f, setF] = useState<CommerceForm>(initial);
  const [busy, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CommerceForm>(k: K, v: CommerceForm[K]) => setF((s) => ({ ...s, [k]: v }));

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setFlash({ ok: false, text: "Elegí un archivo de imagen (PNG o JPG)." }); return; }
    try {
      const dataUrl = await resizeImage(file);
      set("logo", dataUrl);
      setFlash(null);
    } catch {
      setFlash({ ok: false, text: "No se pudo procesar la imagen." });
    }
  }

  function guardar() {
    if (!f.name.trim()) { setFlash({ ok: false, text: "El nombre del comercio es obligatorio." }); return; }
    start(async () => {
      const res = await saveCommerce(f);
      setFlash(res.ok ? { ok: true, text: "Datos del comercio guardados ✓" } : { ok: false, text: res.error ?? "No se pudo guardar." });
    });
  }

  const condLabel = CONDICIONES.find((c) => c.v === f.taxCondition)?.l ?? f.taxCondition;
  const letra = f.taxCondition === "responsable_inscripto" ? "A" : "B";

  return (
    <>
      <Topbar title="Datos del comercio" subtitle="Identidad fiscal y logo · aparecen en los comprobantes" />
      <div className="cx-view">
        <div className="split" style={{ alignItems: "start" }}>
          {/* Formulario */}
          <div className="card card-pad">
            <div className="cx-panel-h" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 14 }}>Identidad fiscal</h3>
              {!canEdit && <span className="pill pill-mute" style={{ fontSize: 10 }}>solo lectura</span>}
            </div>

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 84, height: 84, borderRadius: 12, border: "1px dashed var(--line)", display: "grid", placeItems: "center", overflow: "hidden", background: "var(--panel-2, rgba(255,255,255,.03))" }}>
                {f.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.logo} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  : <Icon name="idcard" size={26} />}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
                <button className="btn" onClick={() => fileRef.current?.click()} disabled={!canEdit}><Icon name="check" size={14} /> Subir logo</button>
                {f.logo && <button className="btn" onClick={() => set("logo", null)} disabled={!canEdit} style={{ marginLeft: 8 }}>Quitar</button>}
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>PNG o JPG. Se reescala solo a un tamaño liviano.</div>
              </div>
            </div>

            <div className="field"><label>Nombre de fantasía</label><input className="inp" value={f.name} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} placeholder="Kiosco El Sol" /></div>
            <div className="field"><label>Razón social</label><input className="inp" value={f.legalName} onChange={(e) => set("legalName", e.target.value)} disabled={!canEdit} placeholder="El Sol S.R.L." /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="field"><label>CUIT</label><input className="inp" value={f.taxId} onChange={(e) => set("taxId", e.target.value)} disabled={!canEdit} placeholder="30-12345678-9" /></div>
              <div className="field"><label>Condición frente al IVA</label>
                <select className="inp" value={f.taxCondition} onChange={(e) => set("taxCondition", e.target.value as CommerceForm["taxCondition"])} disabled={!canEdit}>
                  {CONDICIONES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Domicilio comercial</label><input className="inp" value={f.address} onChange={(e) => set("address", e.target.value)} disabled={!canEdit} placeholder="Av. Siempreviva 742, CABA" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="field"><label>Ingresos Brutos</label><input className="inp" value={f.grossIncome} onChange={(e) => set("grossIncome", e.target.value)} disabled={!canEdit} placeholder="Nº IIBB / Convenio" /></div>
              <div className="field"><label>Inicio de actividades</label><input className="inp" type="date" value={f.activityStart ?? ""} onChange={(e) => set("activityStart", e.target.value)} disabled={!canEdit} /></div>
            </div>

            {flash && (
              <div className="note" style={{ marginTop: 6, ...(flash.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
                <Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span>
              </div>
            )}
            {canEdit && (
              <button className="btn btn-primary" onClick={guardar} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
                {busy ? "Guardando…" : "Guardar datos del comercio"}
              </button>
            )}
          </div>

          {/* Vista previa del comprobante */}
          <div className="card card-pad">
            <div className="cx-panel-h" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 14 }}>Vista previa del comprobante</h3><span className="muted" style={{ fontSize: 11 }}>así se ve el ticket</span></div>
            <div style={{ background: "#fff", color: "#111", borderRadius: 10, padding: 18, maxWidth: 360, margin: "0 auto", fontFamily: "ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.5 }}>
              <div style={{ textAlign: "center" }}>
                {f.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.logo} alt="logo" style={{ maxHeight: 56, maxWidth: 200, objectFit: "contain", marginBottom: 6 }} />
                )}
                <div style={{ fontWeight: 800, fontSize: 15 }}>{f.name || "Nombre del comercio"}</div>
                {f.legalName && <div>{f.legalName}</div>}
                {f.taxId && <div>CUIT {f.taxId}</div>}
                <div>{condLabel}</div>
                {f.address && <div>{f.address}</div>}
                {f.grossIncome && <div>IIBB: {f.grossIncome}</div>}
              </div>
              <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
              <div style={{ fontWeight: 800, fontSize: 14 }}>FACTURA {letra}</div>
              <div>{letra} 0001-00000001</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fecha: hoy</span><span>Consumidor Final</span></div>
              <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
              <div>Coca-Cola 2,25L</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>&nbsp;&nbsp;2 u x {money(2400)}</span><span>{money(4800)}</span></div>
              <div>Pan lactal</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>&nbsp;&nbsp;1 u x {money(1980)}</span><span>{money(1980)}</span></div>
              <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Neto gravado</span><span>{money(5603)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>IVA 21%</span><span>{money(1177)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}><span>TOTAL</span><span>{money(6780)}</span></div>
              <div style={{ textAlign: "center", marginTop: 10, color: "#555" }}>Gracias por su compra</div>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Cuando la venta se autorice con AFIP, el ticket agrega el <b>CAE</b>, su vencimiento y el <b>QR</b> fiscal automáticamente.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
