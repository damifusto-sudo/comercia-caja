"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { saveProduct, toggleProductActive, type ProductInput, type PriceTier } from "./actions";
import { loadStock, adjustStock } from "../stock/actions";
import { useScale } from "@/lib/useScale";

export type ProdRow = {
  id: string; name: string; sku: string; baseUnit: "u" | "kg" | "l"; isWeighed: boolean;
  cost: number; salePrice: number; minStock: number; emoji: string; barcode: string; active: boolean;
  priceTier: PriceTier | null; priceManual: boolean; category: string;
  stock: number; pending: number; dailyEst: number;
};
export type Cat = { id: string; name: string };
export type ExpiryItem = {
  name: string; branch: string | null; lot_code: string | null;
  expiry_date: string; qty: number; capital: number; days_left: number;
};

const UNITS = [{ v: "u", l: "Unidad" }, { v: "kg", l: "Kilo" }, { v: "l", l: "Litro" }] as const;
const TIERS: { v: PriceTier; l: string; pct: number }[] = [
  { v: "premium", l: "Premium", pct: 40 },
  { v: "normal", l: "Normal", pct: 30 },
  { v: "oferta", l: "Oferta", pct: 20 },
];
const tierPct = (t: PriceTier | null) => TIERS.find((x) => x.v === t)?.pct ?? 0;
const suggest = (cost: number, tier: PriceTier | null) => (tier && cost > 0 ? Math.round(cost * (1 + tierPct(tier) / 100)) : 0);

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const marginPct = (p: { cost: number; salePrice: number }) =>
  p.salePrice > 0 && p.cost > 0 ? (p.salePrice - p.cost) / p.salePrice : null;
const unitLabelRow = (p: ProdRow) => (p.isWeighed ? "kg" : p.baseUnit === "l" ? "l" : "u.");
const unitOpts = (unit: string) =>
  unit === "kg"
    ? [{ label: "kilos (kg)", factor: 1 }, { label: "gramos (g)", factor: 0.001 }]
    : [{ label: "unidades", factor: 1 }, { label: "docena (×12)", factor: 12 }, { label: "pack (×6)", factor: 6 }, { label: "caja (×24)", factor: 24 }];

const emptyForm: ProductInput = {
  name: "", category: "", sku: "", baseUnit: "u", isWeighed: false, cost: 0, salePrice: 0,
  minStock: 0, emoji: "", barcode: "", active: true, priceTier: "normal", priceManual: false,
};

const covDays = (r: ProdRow) => (r.dailyEst > 0 ? r.stock / r.dailyEst : Infinity);
const lowStock = (r: ProdRow) => (r.minStock > 0 ? r.stock <= r.minStock : covDays(r) <= 3);

export default function ProductosClient({
  products, categories, branchId, expiry = [],
}: { products: ProdRow[]; categories: Cat[]; branchId: string; expiry?: ExpiryItem[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // ── Alta / edición de producto ────────────────────────────────────────────
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // ── Operaciones de stock (cargar / ajustar) ───────────────────────────────
  const [opProd, setOpProd] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitIdx, setUnitIdx] = useState(0);
  const scale = useScale();
  const [adjCount, setAdjCount] = useState("");
  const [adjKind, setAdjKind] = useState<"merma" | "perdida">("merma");
  const [adjReason, setAdjReason] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPass, setSupPass] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjMsg, setAdjMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const opSel = products.find((p) => p.id === opProd) ?? products[0];
  const opts = unitOpts(opSel ? unitLabelRow(opSel) : "u.");

  const filtered = useMemo(() => {
    const v = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyLow && !lowStock(p)) return false;
      return !v || p.name.toLowerCase().includes(v) || p.barcode.includes(v) || p.category.toLowerCase().includes(v) || p.sku.toLowerCase().includes(v);
    });
  }, [products, q, onlyLow]);

  const lowCount = products.filter(lowStock).length;
  const pendTotal = products.reduce((s, p) => s + p.pending, 0);

  function nuevo() { setForm(emptyForm); setEditing(null); setOpen(true); setFlash(null); }
  function edit(p: ProdRow) {
    setForm({
      id: p.id, name: p.name, category: p.category, sku: p.sku, baseUnit: p.baseUnit, isWeighed: p.isWeighed,
      cost: p.cost, salePrice: p.salePrice, minStock: p.minStock, emoji: p.emoji, barcode: p.barcode,
      active: p.active, priceTier: p.priceTier, priceManual: p.priceManual,
    });
    setEditing(p.id); setOpen(true); setFlash(null);
  }
  const set = (k: keyof ProductInput, val: ProductInput[keyof ProductInput]) => setForm((f) => ({ ...f, [k]: val }));

  // Cambiar el costo: si hay etiqueta y el precio NO está fijado a mano, recalcula.
  function setCost(v: number) {
    setForm((f) => {
      const price = f.priceTier && !f.priceManual ? suggest(v, f.priceTier) : f.salePrice;
      return { ...f, cost: v, salePrice: price };
    });
  }
  // Elegir etiqueta: recalcula el precio desde el costo y vuelve a modo automático.
  function setTier(t: PriceTier) {
    setForm((f) => ({ ...f, priceTier: t, priceManual: false, salePrice: suggest(f.cost, t) || f.salePrice }));
  }
  // Editar el precio a mano: pasa a modo manual (la compra no lo pisa).
  function setPriceManual(v: number) { setForm((f) => ({ ...f, salePrice: v, priceManual: true })); }

  function guardar() {
    if (!form.name.trim()) { setFlash({ ok: false, text: "El nombre es obligatorio." }); return; }
    start(async () => {
      const res = await saveProduct({ ...form, cost: Number(form.cost) || 0, salePrice: Number(form.salePrice) || 0, minStock: Number(form.minStock) || 0 });
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo guardar." }); return; }
      setFlash({ ok: true, text: editing ? "Producto actualizado ✓" : "Producto creado ✓ — ya está en Caja/POS" });
      setOpen(false);
      router.refresh();
    });
  }
  function toggle(p: ProdRow) {
    start(async () => {
      const res = await toggleProductActive(p.id, !p.active);
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo cambiar." }); return; }
      router.refresh();
    });
  }

  // ── Cargar stock ──
  function cargar(base: number, entered: string, src: "balanza" | "manual") {
    if (!opSel || base <= 0) return;
    start(async () => {
      const res = await loadStock({ productId: opSel.id, branchId, base, enteredQty: base, enteredUnit: entered, source: src });
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo cargar." }); return; }
      setFlash({ ok: true, text: `Stock cargado: +${entered} en ${opSel.name}.` });
      router.refresh();
    });
  }
  function cargarBalanza() { const kg = +scale.weight.toFixed(3); cargar(kg, kg.toFixed(3) + " kg", "balanza"); }
  function cargarManual() {
    const n = parseFloat(qty.replace(",", ".")) || 0;
    if (n <= 0 || !opSel) return;
    const f = opts[unitIdx].factor;
    const base = n * f;
    const entered = opSel.isWeighed
      ? (f === 1 ? `${n} kg` : `${n} g`)
      : (f === 1 ? `${n} u.` : `${n} × ${opts[unitIdx].label.replace(/\s*\(.*\)/, "")}`);
    cargar(base, entered, "manual");
    setQty("");
  }

  // ── Ajuste de inventario ──
  const adjContada = parseFloat(adjCount.replace(",", "."));
  const adjDelta = opSel && !isNaN(adjContada) ? Math.round((adjContada - opSel.stock) * 1000) / 1000 : 0;
  async function aplicarAjuste() {
    if (!opSel) return;
    if (isNaN(adjContada) || adjContada < 0) { setAdjMsg({ ok: false, text: "Ingresá la cantidad física contada." }); return; }
    if (adjDelta === 0) { setAdjMsg({ ok: false, text: "La cantidad contada coincide con el sistema." }); return; }
    const kind = adjDelta < 0 ? adjKind : "sobrante";
    setAdjBusy(true);
    const res = await adjustStock({ productId: opSel.id, branchId, delta: adjDelta, reason: adjReason, kind, supervisorEmail: supEmail, supervisorPassword: supPass });
    setAdjBusy(false);
    if (!res.ok) { setAdjMsg({ ok: false, text: res.error ?? "No se pudo aplicar el ajuste." }); return; }
    const label = res.account === "PERD" ? "pérdida" : res.account === "MERMA" ? "merma" : "sobrante";
    setAdjMsg({ ok: true, text: `Ajuste aplicado: ${adjDelta > 0 ? "+" : ""}${adjDelta} ${unitLabelRow(opSel)} · ${label} ${money(res.valued ?? 0)} · autorizado ✓` });
    setAdjCount(""); setAdjReason(""); setSupEmail(""); setSupPass("");
    router.refresh();
  }

  const flashStyle = (ok: boolean) => ok
    ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" }
    : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" };

  const formSuggest = suggest(Number(form.cost) || 0, form.priceTier);

  return (
    <>
      <Topbar title="Productos y stock" subtitle="Catálogo · precios · existencias · en vivo" />
      <div className="cx-view">
        <div className="kpi-grid">
          <div className="card kpi"><div className="kpi-l">Productos</div><div className="kpi-v">{products.length}</div></div>
          <div className="card kpi"><div className="kpi-l">Bajo stock</div><div className="kpi-v" style={{ color: lowCount > 0 ? "var(--amber)" : "var(--ink-2)" }}>{lowCount}</div><div className="kpi-d">a reponer</div></div>
          <div className="card kpi"><div className="kpi-l">En camino (OC)</div><div className="kpi-v" style={{ color: "var(--cyan)" }}>{pendTotal}</div></div>
          <div className="card kpi"><div className="kpi-l">Por vencer</div><div className="kpi-v" style={{ color: expiry.length > 0 ? "var(--amber)" : "var(--ink-2)" }}>{expiry.length}</div><div className="kpi-d">30 días</div></div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0", flexWrap: "wrap" }}>
          <div className="pos-search" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.2-4.2" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código, categoría o SKU…" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Solo bajo stock
          </label>
          <button className="btn btn-primary" onClick={nuevo}><Icon name="box" size={16} /> Nuevo producto</button>
        </div>

        {flash && <div className="note" style={{ marginBottom: 14, ...flashStyle(flash.ok) }}><Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span></div>}

        {/* Alta / edición */}
        {open && (
          <div className="card card-pad" style={{ marginBottom: 16, borderColor: "var(--acc-line)" }}>
            <div className="cx-panel-h" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 14 }}>{editing ? "Editar producto" : "Nuevo producto"}</h3>
              <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setOpen(false)}>Cerrar</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: 12 }}>
              <div className="field"><label>Emoji</label><input className="inp" value={form.emoji} onChange={(e) => set("emoji", e.target.value)} placeholder="📦" maxLength={4} style={{ textAlign: "center" }} /></div>
              <div className="field"><label>Nombre *</label><input className="inp" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Yerba Playadito 1kg" /></div>
              <div className="field"><label>Categoría</label>
                <input className="inp" list="cats" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Elegí o escribí una nueva" />
                <datalist id="cats">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </div>
            </div>

            {/* Precio por etiqueta */}
            <div className="field" style={{ marginTop: 12 }}>
              <label>Etiqueta de precio (marcación sobre el costo)</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TIERS.map((t) => (
                  <button key={t.v} type="button" onClick={() => setTier(t.v)}
                    className={"btn " + (form.priceTier === t.v && !form.priceManual ? "btn-primary" : "")}
                    style={{ padding: "7px 14px" }}>
                    {t.l} <span style={{ opacity: 0.7 }}>+{t.pct}%</span>
                  </button>
                ))}
                {form.priceManual && <span className="pill pill-warn" style={{ alignSelf: "center" }}>precio a mano</span>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 10 }}>
              <div className="field"><label>Costo</label><input className="inp" type="number" value={form.cost || ""} onChange={(e) => setCost(Number(e.target.value))} placeholder="0" /></div>
              <div className="field">
                <label>Precio de venta {form.priceTier && !form.priceManual && form.cost > 0 ? <span className="muted">(auto)</span> : null}</label>
                <input className="inp" type="number" value={form.salePrice || ""} onChange={(e) => setPriceManual(Number(e.target.value))} placeholder="0" />
                {form.priceTier && form.cost > 0 && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    Sugerido {form.priceTier}: {money(formSuggest)}
                    {form.priceManual && <button type="button" className="btn" style={{ marginLeft: 8, padding: "1px 8px", fontSize: 11 }} onClick={() => setTier(form.priceTier as PriceTier)}>volver a auto</button>}
                  </span>
                )}
              </div>
              <div className="field"><label>Unidad</label>
                <select className="inp" value={form.isWeighed ? "kg" : form.baseUnit} disabled={form.isWeighed} onChange={(e) => set("baseUnit", e.target.value as "u" | "kg" | "l")}>
                  {UNITS.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
                </select>
              </div>
              <div className="field"><label>Stock mínimo</label><input className="inp" type="number" value={form.minStock || ""} onChange={(e) => set("minStock", Number(e.target.value))} placeholder="0" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div className="field"><label>Código de barras</label><input className="inp" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Escaneá o tipeá el código" /></div>
              <div className="field"><label>SKU interno</label><input className="inp" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Opcional" /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={form.isWeighed} onChange={(e) => set("isWeighed", e.target.checked)} /> Se vende por peso (balanza)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activo (visible en Caja/POS)
              </label>
              <span style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={guardar} disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}</button>
            </div>
          </div>
        )}

        {/* Tabla unificada */}
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th>Producto</th><th>Categoría</th><th className="num">Precio</th><th className="num">Costo</th>
              <th className="num">Margen</th><th className="num">Stock</th><th className="num">Mín.</th>
              <th className="num">Cobertura</th><th className="num">En camino</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="muted" style={{ textAlign: "center", padding: "24px 0" }}>{q || onlyLow ? "Sin resultados." : "Todavía no hay productos. Creá el primero."}</td></tr>
              ) : filtered.map((p) => {
                const m = marginPct(p);
                const low = lowStock(p);
                const cd = covDays(p);
                return (
                  <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                    <td><span style={{ marginRight: 8 }}>{p.emoji || "📦"}</span>{p.name}{p.isWeighed && <span className="pill pill-plain" style={{ marginLeft: 8, fontSize: 10 }}>⚖ kg</span>}</td>
                    <td className="muted">{p.category || "—"}</td>
                    <td className="num tnum">{money(p.salePrice)}</td>
                    <td className="num tnum muted">{money(p.cost)}</td>
                    <td className="num">
                      {p.priceTier && <span className="pill pill-plain" style={{ fontSize: 10, marginRight: 6 }}>{p.priceTier}{p.priceManual ? "·man" : ""}</span>}
                      {m !== null ? <span style={{ color: m <= 0 ? "var(--red)" : m < 0.15 ? "var(--amber)" : "var(--green)" }}>{(m * 100).toFixed(0)}%</span> : <span className="muted">—</span>}
                    </td>
                    <td className="num tnum" style={{ color: low ? "var(--amber)" : "var(--ink-2)", fontWeight: low ? 700 : 400 }}>{p.isWeighed ? p.stock.toFixed(2) : Math.round(p.stock)}</td>
                    <td className="num tnum muted">{p.minStock || "—"}</td>
                    <td className="num">{cd === Infinity ? <span className="muted">—</span> : <span className={"pill " + (cd <= 3 ? "pill-bad" : cd <= 7 ? "pill-warn" : "pill-ok")}>{Math.floor(cd)} d</span>}</td>
                    <td className="num tnum" style={{ color: p.pending > 0 ? "var(--cyan)" : "var(--dim)" }}>{p.pending || "—"}</td>
                    <td><span className={"pill " + (p.active ? "pill-ok" : "pill-mute")}>{p.active ? "Activo" : "Inactivo"}</span></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => { setOpProd(p.id); edit(p); }}>Editar</button>
                      <button className="btn" style={{ padding: "5px 10px", fontSize: 12, marginLeft: 6 }} onClick={() => toggle(p)} disabled={busy}>{p.active ? "Desactivar" : "Activar"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Operaciones de stock */}
        <div className="split" style={{ marginTop: 15 }}>
          {/* Cargar stock */}
          <div className="card card-pad">
            <div className="cx-panel-h" style={{ paddingLeft: 0, paddingRight: 0 }}><h3>Cargar stock</h3><span className="muted" style={{ fontSize: 11 }}>ingreso de mercadería</span></div>
            <div className="field" style={{ marginTop: 6 }}>
              <label>Producto</label>
              <select className="inp" value={opProd} onChange={(e) => setOpProd(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.emoji || "📦"} {p.name} — {p.isWeighed ? p.stock.toFixed(2) : Math.round(p.stock)} {unitLabelRow(p)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 120px" }}><label>Cantidad</label><input className="inp" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></div>
              <div className="field" style={{ flex: "1 1 140px" }}><label>Unidad</label>
                <select className="inp" value={unitIdx} onChange={(e) => setUnitIdx(Number(e.target.value))}>
                  {opts.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={cargarManual} disabled={busy}>Cargar</button>
              {opSel?.isWeighed && <button className="btn" onClick={cargarBalanza} disabled={busy} title="Tomar peso de la balanza">⚖ Balanza ({scale.weight.toFixed(3)} kg)</button>}
            </div>
          </div>

          {/* Ajuste de inventario */}
          <div className="card card-pad">
            <div className="cx-panel-h" style={{ paddingLeft: 0, paddingRight: 0 }}><h3>Ajuste de inventario</h3><span className="muted" style={{ fontSize: 11 }}>recuento físico · requiere autorización</span></div>
            {adjMsg && <div className="note" style={{ margin: "8px 0", ...flashStyle(adjMsg.ok) }}><Icon name={adjMsg.ok ? "check" : "alert"} size={15} /><span>{adjMsg.text}</span></div>}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 6, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 120px" }}><label>Contado físico ({opSel ? unitLabelRow(opSel) : "u."})</label><input className="inp" inputMode="decimal" value={adjCount} onChange={(e) => setAdjCount(e.target.value)} placeholder={opSel ? String(opSel.isWeighed ? opSel.stock.toFixed(2) : Math.round(opSel.stock)) : "0"} /></div>
              <div className="field" style={{ flex: "0 0 auto" }}><label>Diferencia</label><div className="inp" style={{ minWidth: 90, textAlign: "right", color: adjDelta < 0 ? "var(--red)" : adjDelta > 0 ? "var(--green)" : "var(--dim)" }}>{adjDelta > 0 ? "+" : ""}{adjDelta}</div></div>
              {adjDelta < 0 && (
                <div className="field" style={{ flex: "1 1 130px" }}><label>Tipo</label>
                  <select className="inp" value={adjKind} onChange={(e) => setAdjKind(e.target.value as "merma" | "perdida")}>
                    <option value="merma">Merma (esperable)</option>
                    <option value="perdida">Pérdida (robo/rotura)</option>
                  </select>
                </div>
              )}
            </div>
            <div className="field" style={{ marginTop: 10 }}><label>Motivo</label><input className="inp" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Ej. recuento mensual, rotura…" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div className="field"><label>Email del responsable</label><input className="inp" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} placeholder="supervisor@…" autoComplete="off" /></div>
              <div className="field"><label>Contraseña del responsable</label><input className="inp" type="password" value={supPass} onChange={(e) => setSupPass(e.target.value)} autoComplete="new-password" /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={aplicarAjuste} disabled={adjBusy}>{adjBusy ? "Aplicando…" : "Aplicar ajuste autorizado"}</button>
          </div>
        </div>

        {/* Vencimientos próximos */}
        {expiry.length > 0 && (
          <div className="card" style={{ marginTop: 15, overflowX: "auto" }}>
            <div className="cx-panel-h">
              <h3>Vencimientos próximos</h3>
              <span className="pill pill-warn" style={{ fontSize: 10 }}>{expiry.filter((e) => e.days_left < 0).length} vencidos · {expiry.length} en 30 días</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Producto</th><th>Lote</th><th>Sucursal</th><th className="num">Stock</th><th className="num">Capital</th><th className="num">Vence</th></tr></thead>
              <tbody>
                {expiry.slice(0, 15).map((e, idx) => {
                  const vencido = e.days_left < 0; const pronto = e.days_left >= 0 && e.days_left <= 7;
                  return (
                    <tr key={idx}>
                      <td style={{ color: "var(--ink-2)" }}>{e.name}</td>
                      <td className="muted">{e.lot_code ?? "—"}</td>
                      <td className="muted">{e.branch ?? "—"}</td>
                      <td className="num tnum">{e.qty}</td>
                      <td className="num tnum muted">{money(e.capital)}</td>
                      <td className="num"><span className={"pill " + (vencido ? "pill-bad" : pronto ? "pill-warn" : "pill-ok")}>{vencido ? `vencido hace ${Math.abs(e.days_left)}d` : `${e.days_left} días`}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 11, padding: "2px 16px 14px" }}><Icon name="alert" size={13} /> El lote y el vencimiento se cargan al recibir la orden de compra (Compras → Recepción).</div>
          </div>
        )}
      </div>
    </>
  );
}
