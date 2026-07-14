"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { money } from "@/lib/seed";
import { useScale } from "@/lib/useScale";
import { createSale, type SaleMethod } from "./actions";
import { getTicketData } from "./ticket-actions";
import { composeTicket, type TicketData } from "@/lib/ticket";
import { useThermalPrinter } from "@/lib/useThermalPrinter";
import { enqueueSale, getQueue, removeSale, updateSale, queueCount, cacheProducts, type OfflineSale } from "@/lib/offlineSales";
import { walkinCustomer } from "./walkin";
import { useBarcodeScanner } from "@/lib/useBarcodeScanner";

const nf = (n: number) => Math.round(n).toLocaleString("es-AR");

export type PosItem = {
  id: string;
  emoji: string;
  name: string;
  cat: string;
  weighed: boolean;
  /** precio por unidad, o por kg si weighed */
  price: number;
  /** stock disponible en la sucursal (u. o kg) */
  stock?: number;
  /** unidades vendidas en los últimos 30 días (ranking de más vendidos) */
  sold?: number;
  /** código de barras para el lector */
  barcode?: string | null;
};
export type ClienteLite = { id: string; name: string };
export type QrWallet = { id: string; name: string; qr: string; feeRate: number };
/** Medio de acreditación (banco/billetera/tarjeta) con su comisión. */
export type PayAccount = { id: string; name: string; feeRate: number };

type Line = { productId: string; name: string; weighed: boolean; qty?: number; kg?: number; price: number; total: number };

const METHODS = [
  { key: "efectivo", label: "Efectivo", icon: "cash" },
  { key: "tarjeta", label: "Tarjeta", icon: "card" },
  { key: "cta_cte", label: "Cta. cte.", icon: "users" },
  { key: "qr", label: "QR / MP", icon: "qr" },
] as const;

// Mapea el botón del POS al método del motor de venta (create_sale)
const METHOD_MAP: Record<string, SaleMethod> = {
  efectivo: "efectivo",
  tarjeta: "tarjeta",
  qr: "qr",
  cta_cte: "cta_cte",
};

export type PosBoardProps = {
  clientes: ClienteLite[];
  products: PosItem[];
  branchId: string;
  qrWallets: QrWallet[];
  cardAccounts: PayAccount[];
  /** medios de pago habilitados; por defecto todos. La caja del cajero usa ["efectivo"]. */
  methods?: string[];
};

/** Tablero del POS (grilla + balanza + ticket + cobro), sin Topbar. Se usa solo
 *  dentro de /ventas (admin) y embebido en la ventana única de Caja del cajero. */
export function PosBoard({
  clientes,
  products,
  branchId,
  qrWallets,
  cardAccounts,
  methods,
}: PosBoardProps) {
  const shownMethods = methods ? METHODS.filter((m) => methods.includes(m.key)) : METHODS;
  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(products.map((p) => p.cat)))],
    [products],
  );
  const [cat, setCat] = useState("Todos");
  const [query, setQuery] = useState("");
  const [weigh, setWeigh] = useState<PosItem | null>(null); // pesable esperando confirmación de peso
  const [ticket, setTicket] = useState<Line[]>([]);
  const [ticketNo, setTicketNo] = useState(4822);
  const [method, setMethod] = useState<string | null>(null);
  const [cliente, setCliente] = useState("");
  const [extra, setExtra] = useState<ClienteLite[]>([]); // clientes ocasionales creados en el turno
  const [showWalkin, setShowWalkin] = useState(false);
  const [wDni, setWDni] = useState("");
  const [wName, setWName] = useState("");
  const [wBusy, setWBusy] = useState(false);
  const [qrWalletId, setQrWalletId] = useState("");
  const [cardAccountId, setCardAccountId] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const scale = useScale(); // balanza real (Web Serial) con fallback a simulación
  const weight = scale.weight;
  const printer = useThermalPrinter(); // térmica ESC/POS por WebUSB
  const [lastSale, setLastSale] = useState<{ docId: string; method: string } | null>(null);
  const [online, setOnline] = useState(true);   // conexión a internet
  const [pending, setPending] = useState(0);     // ventas offline en cola
  const selectedQr = qrWallets.find((w) => w.id === qrWalletId) ?? qrWallets[0];
  const selectedCard = cardAccounts.find((a) => a.id === cardAccountId) ?? cardAccounts[0];

  function add(p: PosItem) {
    if (p.weighed) {
      const kg = Math.max(0.001, +weight.toFixed(3));
      setTicket((t) => [...t, { productId: p.id, name: p.name, weighed: true, kg, price: p.price, total: Math.round(kg * p.price) }]);
    } else {
      setTicket((t) => {
        const ex = t.find((l) => !l.weighed && l.productId === p.id);
        if (ex) return t.map((l) => (l === ex ? { ...l, qty: l.qty! + 1, total: (l.qty! + 1) * p.price } : l));
        return [...t, { productId: p.id, name: p.name, weighed: false, qty: 1, price: p.price, total: p.price }];
      });
    }
  }

  // Editar / quitar líneas del ticket
  function changeQty(i: number, delta: number) {
    setTicket((t) => t.map((l, j) => {
      if (j !== i || l.weighed) return l;
      const q = Math.max(1, (l.qty ?? 1) + delta);
      return { ...l, qty: q, total: q * l.price };
    }));
  }
  function setKg(i: number, kg: number) {
    setTicket((t) => t.map((l, j) => {
      if (j !== i || !l.weighed) return l;
      const k = Math.max(0.001, Math.round(kg * 1000) / 1000);
      return { ...l, kg: k, total: Math.round(k * l.price) };
    }));
  }
  function removeLine(i: number) { setTicket((t) => t.filter((_, j) => j !== i)); }

  // Lector de código de barras (HID): busca por código y agrega. Si es pesable,
  // abre la confirmación de peso en vez de agregar a ciegas.
  function addByBarcode(code: string) {
    const p = products.find((x) => x.barcode && x.barcode === code.trim());
    if (!p) { setFlash({ ok: false, text: `Código ${code} sin producto asociado.` }); return; }
    if (p.weighed) { setWeigh(p); setFlash({ ok: true, text: `${p.name}: poné el producto en la balanza y confirmá el peso.` }); return; }
    add(p);
    setFlash({ ok: true, text: `${p.name} agregado (escaneo).` });
  }
  useBarcodeScanner(addByBarcode);

  // Confirmación de peso: toma el peso ESTABLE al confirmar (no al tocar)
  function confirmWeigh() {
    if (!weigh) return;
    add(weigh);
    setWeigh(null);
  }

  function renderItem(p: PosItem, rank?: number) {
    const out = p.stock != null && p.stock <= 0;
    const lvl = p.stock == null ? "" : p.stock <= 0 ? "out" : p.stock <= (p.weighed ? 3 : 7) ? "low" : "ok";
    const stkTxt = p.stock == null ? "" : p.stock <= 0 ? "sin stock" : p.weighed ? p.stock.toFixed(1) + " kg" : Math.round(p.stock) + " u.";
    return (
      <button
        key={(rank ? "t" : "") + p.id}
        className={"pitem" + (p.weighed ? " weighed" : "") + (rank ? " top" : "") + (out ? " out" : "")}
        onClick={() => (p.weighed ? setWeigh(p) : add(p))}
      >
        {rank ? <span className="rank">{String(rank).padStart(2, "0")}</span> : null}
        {p.weighed && <span className="pw-badge">⚖ kg</span>}
        <span className="pitem-emo">{p.emoji}</span>
        <span className="pitem-n">{p.name}</span>
        <div className="pfoot">
          {p.stock != null ? <span className={"stk " + lvl}>{stkTxt}</span> : <span />}
          <span className="pitem-p">$ {nf(p.price)}{p.weighed && <small> /kg</small>}</span>
        </div>
      </button>
    );
  }

  const total = ticket.reduce((s, l) => s + l.total, 0);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const rows = searching
    ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q))
    : products.filter((p) => cat === "Todos" || p.cat === cat);
  const topSellers = products
    .filter((p) => (p.sold ?? 0) > 0)
    .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
    .slice(0, 5);
  const isCuenta = method === "cta_cte";

  // Medio de acreditación + comisión según el método elegido (tarjeta/QR)
  const payAccount = method === "qr" ? selectedQr : method === "tarjeta" ? selectedCard : undefined;
  const feeRate = payAccount?.feeRate ?? 0;
  const feeAmount = Math.round((total * feeRate) / 100);
  const netCredit = total - feeAmount;

  function reset() {
    setTicket([]);
    setTicketNo((n) => n + 1);
    setMethod(null);
    setCliente("");
  }

  function usarWalkin() {
    if (!wDni.trim() && !wName.trim()) { setFlash({ ok: false, text: "Ingresá el nombre o el DNI del cliente." }); return; }
    setWBusy(true);
    walkinCustomer(wDni, wName).then((res) => {
      setWBusy(false);
      if (!res.ok || !res.id) { setFlash({ ok: false, text: res.error ?? "No se pudo cargar el cliente." }); return; }
      const nombre = wName.trim() || ("DNI " + wDni.trim());
      setExtra((e) => (e.some((x) => x.id === res.id) ? e : [...e, { id: res.id!, name: nombre + " · ocasional" }]));
      setCliente(res.id);
      setShowWalkin(false); setWDni(""); setWName(""); setFlash({ ok: true, text: `Cliente ${nombre} listo para facturar.` });
    });
  }

  async function printSale(docId: string, methodLabel: string) {
    const res = await getTicketData(docId, methodLabel);
    if (!res.ok || !res.data) { setFlash({ ok: false, text: "No se pudo obtener el ticket: " + (res.error ?? "") }); return; }
    if (!printer.connected) { setFlash({ ok: false, text: "Conectá la impresora térmica para imprimir el ticket." }); return; }
    const pr = await printer.print(composeTicket(res.data));
    if (!pr.ok) setFlash({ ok: false, text: "Error al imprimir: " + (pr.error ?? "") });
  }

  // --- OFFLINE: cola local + sincronización ---
  function composeProvisional(): Uint8Array {
    const data: TicketData = {
      commerce: { name: "COMPROBANTE PROVISORIO", cuit: null, taxCondition: "consumidor_final" },
      number: "OFFLINE - pendiente de registro", letter: "X",
      date: new Date().toLocaleDateString("es-AR"),
      client: "Consumidor Final",
      items: ticket.map((l) => ({ name: l.name, qty: l.weighed ? l.kg! : l.qty!, unit: l.weighed ? "kg" : "u", unitPrice: l.price, total: l.total })),
      net: total / 1.21, vat: total - total / 1.21, total, method: "Efectivo",
      cae: null, caeDue: null, qrUrl: null, fiscal: "pendiente",
    };
    return composeTicket(data);
  }

  async function saveOffline(uid: string) {
    const olines = ticket.map((l) => ({ productId: l.productId, qty: l.weighed ? l.kg! : l.qty! }));
    const sale: OfflineSale = { uid, branchId, method: "efectivo", lines: olines, ref: "Ticket #" + ticketNo, total, createdAt: Date.now(), status: "pendiente" };
    if (printer.connected) { try { await printer.print(composeProvisional()); } catch { /* imprimir es opcional */ } }
    await enqueueSale(sale);
    setPending(await queueCount());
    setFlash({ ok: true, text: `Venta ${money(total)} guardada OFFLINE · se registra sola al volver internet` });
    reset();
  }

  async function syncOffline() {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const q = (await getQueue()).filter((s) => s.status === "pendiente");
    if (!q.length) return;
    let done = 0, failed = 0;
    for (const s of q) {
      try {
        const res = await createSale({ branchId: s.branchId, method: "efectivo", lines: s.lines, partyId: null, ref: s.ref, clientUid: s.uid });
        if (res.ok) { await removeSale(s.uid); done++; }
        else { await updateSale({ ...s, status: "error", error: res.error }); failed++; }
      } catch { break; } // se volvió a caer la red → cortar y reintentar luego
    }
    setPending(await queueCount());
    if (done || failed) setFlash({ ok: failed === 0, text: `Sincronizado: ${done} venta(s) registrada(s)${failed ? ` · ${failed} con error (revisá)` : ""}` });
  }

  useEffect(() => {
    cacheProducts(products);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    queueCount().then(setPending);
    void syncOffline();
    const on = () => { setOnline(true); void syncOffline(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cobrar() {
    if (!ticket.length) return;
    if (!method) { setFlash({ ok: false, text: "Elegí un medio de pago." }); return; }
    if (isCuenta && !cliente) { setFlash({ ok: false, text: "Elegí el cliente de cuenta corriente." }); return; }

    const ref = "Ticket #" + ticketNo;
    const sm = METHOD_MAP[method];
    const label = METHODS.find((m) => m.key === method)!.label;
    const lines = ticket.map((l) => ({ productId: l.productId, qty: l.weighed ? l.kg! : l.qty! }));
    const monto = total;
    const finAccountId = method === "qr" ? selectedQr?.id ?? null : method === "tarjeta" ? selectedCard?.id ?? null : null;
    const fee = feeAmount;
    const uid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(total)}`;

    // Sin conexión → sólo efectivo, se guarda en la cola y se registra al reconectar
    if (!online) {
      if (method !== "efectivo") { setFlash({ ok: false, text: "Sin internet solo se cobra en EFECTIVO." }); return; }
      void saveOffline(uid);
      return;
    }

    start(async () => {
      let res: Awaited<ReturnType<typeof createSale>>;
      try {
        res = await createSale({ branchId, method: sm, lines, partyId: cliente || null, ref, finAccountId, clientUid: uid });
      } catch {
        // Se cortó la conexión durante el cobro
        if (method === "efectivo") { setOnline(false); await saveOffline(uid); }
        else setFlash({ ok: false, text: "Se cortó la conexión. Para cobrar ahora, usá EFECTIVO." });
        return;
      }
      if (!res.ok) { setFlash({ ok: false, text: res.error ?? "No se pudo registrar la venta." }); return; }
      const comp = `${res.letter ?? ""} ${res.number ?? ""}`.trim();
      const netTxt = fee > 0 ? ` · neto acreditado ${money(monto - fee)} (comisión ${money(fee)})` : "";
      const text =
        res.settlement === "pendiente"
          ? `Factura ${comp} a cuenta · ${money(monto)} · IVA ${money(res.vat ?? 0)} → cuenta por cobrar del cliente`
          : `Vendido ${money(monto)} con ${label} · Factura ${comp} · IVA ${money(res.vat ?? 0)}${netTxt} · stock actualizado ✓`;
      setFlash({ ok: true, text });
      if (res.docId) {
        setLastSale({ docId: res.docId, method: label });
        if (printer.connected) void printSale(res.docId, label);
      }
      reset();
    });
  }

  return (
    <div className="pos">
          <div style={{ display: "flex", flexDirection: "column", gap: 15, minWidth: 0 }}>
            {/* balanza */}
            <div className="card">
              <div className="scale">
                <div className="scale-ic">⚖</div>
                <div>
                  <div className="scale-lbl">Balanza {scale.connected ? "· conectada" : ""}</div>
                  <div className="scale-nm">{scale.connected ? <span style={{ color: "var(--green)" }}>● En vivo (Web Serial)</span> : <span style={{ color: "var(--dim)" }}>{scale.status}</span>}</div>
                </div>
                <div className="scale-read" style={{ marginLeft: "auto" }}>
                  <div className="scale-n mono">{weight.toFixed(3)} <small>kg</small></div>
                  <div className="scale-t">{scale.connected ? "peso real" : "peso simulado"}</div>
                </div>
                {scale.connected
                  ? <button className="btn" onClick={scale.disconnect} style={{ marginLeft: 12 }}>Desconectar</button>
                  : <button className="btn" onClick={scale.connect} disabled={!scale.supported} style={{ marginLeft: 12 }} title={scale.supported ? "" : "Usá Chrome o Edge"}><Icon name="check" size={14} /> Conectar balanza</button>}
                {printer.connected
                  ? <button className="btn" onClick={printer.disconnect} style={{ marginLeft: 8 }} title={printer.status}><Icon name="receipt" size={14} /> Impresora ✓</button>
                  : <button className="btn" onClick={printer.connect} disabled={!printer.supported} style={{ marginLeft: 8 }} title={printer.supported ? printer.status : "Usá Chrome o Edge"}><Icon name="receipt" size={14} /> Conectar impresora</button>}
              </div>
              <div className="scale-hint">
                <Icon name="check" size={15} />
                <span>Tocá un artículo <b style={{ color: "var(--acc)" }}>⚖ por peso</b> (o escaneá su código) y confirmá el peso.</span>
              </div>
              {weigh && (
                <div className="weighbar">
                  <span className="big">{weight.toFixed(3)} <small style={{ fontSize: 14, color: "var(--dim)" }}>kg</small></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--ink-2)" }}>{weigh.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{money(Math.round(weight * weigh.price))} · confirmá con el peso estable</div>
                  </div>
                  <span style={{ flex: 1 }} />
                  <button className="btn" onClick={() => setWeigh(null)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={confirmWeigh}>Agregar {weight.toFixed(3)} kg</button>
                </div>
              )}
            </div>

            {/* grilla: buscador + más vendidos + catálogo con stock */}
            <div className="card card-pad">
              <div className="pos-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.2-4.2" /></svg>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cualquier producto — nombre o código…" />
              </div>

              {!searching && topSellers.length > 0 && (
                <>
                  <div className="pos-sub"><span className="dot" />Más vendidos <em>· últimos 30 días</em></div>
                  <div className="catgrid" style={{ marginBottom: 6 }}>{topSellers.map((p, i) => renderItem(p, i + 1))}</div>
                </>
              )}

              {!searching && (
                <div className="seg" style={{ marginTop: 12 }}>
                  {categories.map((c) => (
                    <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>
                  ))}
                </div>
              )}

              <div className="pos-sub" style={{ marginTop: 12 }}><span className="dot" />{searching ? "Resultados de la búsqueda" : "Todo el catálogo"}</div>
              <div className="catgrid">
                {rows.length === 0 ? (
                  <div className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px 0", fontSize: 12.5 }}>
                    {searching ? `Sin resultados para "${query}".` : "No hay productos en esta categoría."}
                  </div>
                ) : (
                  rows.map((p) => renderItem(p))
                )}
              </div>
            </div>
          </div>

          {/* ticket */}
          <div className="card card-pad ticket">
            {(!online || pending > 0) && (
              <div className="note" style={{ marginBottom: 8, alignItems: "center", ...(!online
                ? { background: "color-mix(in srgb,var(--amber) 14%,transparent)", color: "var(--amber)", borderColor: "color-mix(in srgb,var(--amber) 34%,transparent)" }
                : { background: "color-mix(in srgb,var(--cyan) 12%,transparent)", color: "var(--cyan)", borderColor: "color-mix(in srgb,var(--cyan) 30%,transparent)" }) }}>
                <Icon name={online ? "check" : "alert"} size={15} />
                <span style={{ flex: 1 }}>
                  {!online
                    ? "Sin conexión — cobrá en EFECTIVO; se registra al volver internet."
                    : `${pending} venta(s) offline pendientes de registrar.`}
                </span>
                {online && pending > 0 && <button className="btn" style={{ padding: "4px 10px" }} onClick={() => void syncOffline()}>Sincronizar</button>}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ fontSize: 14, color: "var(--ink-2)" }}>Ticket #{ticketNo}</h3>
              <span className="pill pill-plain">{isCuenta && cliente ? clientes.find((c) => c.id === cliente)?.name ?? "Cuenta corriente" : "Consumidor final"}</span>
            </div>
            {ticket.length === 0 ? (
              <div className="muted" style={{ textAlign: "center", padding: "26px 0", fontSize: 12.5 }}>
                Ticket vacío · tocá un producto
              </div>
            ) : (
              ticket.map((l, i) => (
                <div key={i} className="line">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{l.name}</div>
                    <div className="su">{l.weighed ? `$ ${nf(l.price)}/kg` : `$ ${nf(l.price)} c/u`}</div>
                  </div>
                  {l.weighed ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <input
                        key={`kg-${i}-${l.kg}`}
                        className="inp"
                        defaultValue={l.kg}
                        inputMode="decimal"
                        onBlur={(e) => setKg(i, parseFloat(e.target.value.replace(",", ".")) || l.kg!)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        style={{ width: 62, textAlign: "right", padding: "3px 5px" }}
                        title="Editar peso (kg)"
                      />
                      <small className="muted">kg</small>
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <button className="btn" style={{ padding: "1px 8px", lineHeight: 1.4 }} onClick={() => changeQty(i, -1)} aria-label="Menos">−</button>
                      <span className="q" style={{ minWidth: 20, textAlign: "center" }}>{l.qty}</span>
                      <button className="btn" style={{ padding: "1px 8px", lineHeight: 1.4 }} onClick={() => changeQty(i, 1)} aria-label="Más">+</button>
                    </span>
                  )}
                  <span className="lt tnum" style={{ minWidth: 76, textAlign: "right" }}>$ {nf(l.total)}</span>
                  <span className="rm" onClick={() => removeLine(i)} title="Quitar del ticket">×</span>
                </div>
              ))
            )}
            <div style={{ marginTop: 14 }}>
              <div className="tot"><span>Neto gravado</span><span>$ {nf(total / 1.21)}</span></div>
              <div className="tot"><span>IVA 21%</span><span>$ {nf(total - total / 1.21)}</span></div>
              <div className="tot grand"><span>Total</span><span>$ {nf(total)}</span></div>
              {feeRate > 0 && !isCuenta && (
                <>
                  <div className="tot" style={{ color: "var(--amber)" }}><span>Comisión {feeRate}%</span><span>− $ {nf(feeAmount)}</span></div>
                  <div className="tot"><span>Neto a acreditar</span><span>$ {nf(netCredit)}</span></div>
                </>
              )}
            </div>
            <div className="paybtns">
              {shownMethods.map((m) => (
                <button
                  key={m.key}
                  className={"btn" + (method === m.key ? " btn-primary" : "")}
                  onClick={() => { setMethod(m.key); setFlash(null); }}
                >
                  <Icon name={m.icon} size={15} />{m.label}
                </button>
              ))}
            </div>

            {method === "tarjeta" && cardAccounts.length > 0 && (
              <div className="field" style={{ marginTop: 10 }}>
                <label>Acreditación de la tarjeta</label>
                <select className="inp" value={selectedCard?.id ?? ""} onChange={(e) => setCardAccountId(e.target.value)}>
                  {cardAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.feeRate > 0 ? ` · comisión ${a.feeRate}%` : " · sin comisión"}</option>
                  ))}
                </select>
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  La comisión se descuenta del neto que entra a esta cuenta; el cliente igual paga el total.
                </div>
              </div>
            )}

            {method === "qr" && (
              <div className="field" style={{ marginTop: 10 }}>
                {qrWallets.length === 0 ? (
                  <div className="note"><Icon name="qr" size={16} /><span>Todavía no cargaste ningún QR. Andá a <b>Tesorería › Medios de cobro</b> y subí el QR de tu MODO / Mercado Pago / Cuenta DNI.</span></div>
                ) : (
                  <>
                    <label>Billetera</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      {qrWallets.map((w) => (
                        <button key={w.id} type="button" className={"btn" + (selectedQr?.id === w.id ? " btn-primary" : "")} style={{ padding: "6px 12px" }} onClick={() => setQrWalletId(w.id)}>
                          <Icon name="qr" size={14} />{w.name}
                        </button>
                      ))}
                    </div>
                    {selectedQr && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 16, marginTop: 8, border: "1px solid var(--acc-line)", borderRadius: 12, background: "#fff" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedQr.qr} alt={"QR " + selectedQr.name} style={{ width: 230, height: 230, objectFit: "contain" }} />
                        <div style={{ color: "#0a2a24", fontWeight: 700, fontSize: 15, textAlign: "center" }}>Escaneá con {selectedQr.name} y pagá $ {nf(total)}</div>
                        <div style={{ color: "#4a5a55", fontSize: 11 }}>Confirmá el pago en la app del cliente antes de tocar “Cobrar”.</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="field" style={{ marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Cliente {isCuenta ? "de cuenta corriente" : "(opcional · vacío = Consumidor Final)"}
                <span style={{ flex: 1 }} />
                <button type="button" className="btn" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => { setShowWalkin((v) => !v); setFlash(null); }}>
                  <Icon name="idcard" size={12} /> {showWalkin ? "Cerrar" : "No registrado"}
                </button>
              </label>
              <select className="inp" value={cliente} onChange={(e) => setCliente(e.target.value)}>
                <option value="">Consumidor Final</option>
                {[...clientes, ...extra].map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {showWalkin && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8, alignItems: "end", marginTop: 8, padding: 10, border: "1px dashed var(--acc-line)", borderRadius: 10, background: "var(--acc-soft)" }}>
                  <div className="field" style={{ margin: 0 }}><label>DNI / CUIT</label><input className="inp" value={wDni} onChange={(e) => setWDni(e.target.value)} placeholder="30111222" inputMode="numeric" /></div>
                  <div className="field" style={{ margin: 0 }}><label>Nombre</label><input className="inp" value={wName} onChange={(e) => setWName(e.target.value)} placeholder="Nombre y apellido" /></div>
                  <button type="button" className="btn btn-primary" onClick={usarWalkin} disabled={wBusy} style={{ height: 40 }}>{wBusy ? "…" : "Usar"}</button>
                </div>
              )}

              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                {isCuenta
                  ? "Venta a crédito: emite la factura a su cuenta (Debe Clientes). La paga después un cobro que imputa por FIFO."
                  : "Cobrás a cualquiera aunque no esté registrado: con “No registrado” cargás DNI + nombre y la venta le queda a esa persona."}
              </div>
            </div>

            {flash && (
              <div className="note" style={{ marginTop: 10, ...(flash.ok ? { background: "color-mix(in srgb,var(--green) 12%,transparent)", color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 30%,transparent)" } : { background: "color-mix(in srgb,var(--red) 12%,transparent)", color: "var(--red)", borderColor: "color-mix(in srgb,var(--red) 30%,transparent)" }) }}>
                <Icon name={flash.ok ? "check" : "alert"} size={16} /><span>{flash.text}</span>
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={!ticket.length || busy}
              onClick={cobrar}
            >
              {busy ? "Registrando…" : isCuenta ? `Cobrar a cuenta $ ${nf(total)}` : `Cobrar $ ${nf(total)}`}
            </button>
            {lastSale && (
              <button className="btn" style={{ width: "100%", marginTop: 6 }} onClick={() => printSale(lastSale.docId, lastSale.method)}>
                <Icon name="receipt" size={15} /> Reimprimir último ticket
              </button>
            )}
          </div>
        </div>
  );
}

export default function VentasPOS(props: PosBoardProps) {
  return (
    <>
      <Topbar title="Ventas / POS" subtitle="Turno actual" />
      <div className="cx-view">
        <PosBoard {...props} />
      </div>
    </>
  );
}
