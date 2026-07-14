/** Datos de demostración (seed) para construir la UI sin base de datos.
 *  Se reemplazará por consultas a Supabase manteniendo estas mismas formas. */

export const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

export type StationLight = "green" | "amber" | "red" | "cyan";

export type Station = {
  key: string;
  href: string;
  label: string;
  value: string;
  sub: string;
  light: StationLight;
  accent: string;
  ready?: boolean;
};

export const stations: Station[] = [
  { key: "caja", href: "/caja", label: "Caja · Efectivo", value: money(237530), sub: "Electrónico " + money(87490) + " · 2 cajas", light: "green", accent: "#39d98a" },
  { key: "ventas", href: "/ventas", label: "Ventas de hoy", value: "48 tickets", sub: "Recaudado " + money(325020), light: "green", accent: "#2fe6c8" },
  { key: "stock", href: "/stock", label: "Stock · Alertas", value: "4 críticos", sub: "3 genéricos en rojo", light: "red", accent: "#4be0a8" },
  { key: "servicios", href: "/servicios", label: "Servicios · Adeudado", value: money(258300), sub: "5 facturas pendientes", light: "amber", accent: "#49d6c4" },
  { key: "valores", href: "/valores", label: "Por depositar", value: money(312740), sub: "6 valores en cartera", light: "amber", accent: "#31d3c9" },
  { key: "tesoreria", href: "/tesoreria", label: "Tesorería", value: money(4820000), sub: "Últ. entrada + " + money(129130), light: "cyan", accent: "#26cdb4" },
];

export type Generic = { name: string; brands: number; start: number; current: number; emoji: string };

export const generics: Generic[] = [
  { name: "Yerba", brands: 5, start: 60, current: 38, emoji: "🧉" },
  { name: "Gaseosas", brands: 9, start: 140, current: 82, emoji: "🥤" },
  { name: "Lácteos", brands: 7, start: 95, current: 54, emoji: "🥛" },
  { name: "Fiambres", brands: 6, start: 45, current: 11, emoji: "🧀" },
  { name: "Limpieza", brands: 11, start: 120, current: 96, emoji: "🧴" },
  { name: "Cervezas", brands: 7, start: 96, current: 19, emoji: "🍺" },
];

// ---------------------------------------------------------------------------
// Cajas (para el módulo Caja diaria)
// ---------------------------------------------------------------------------
export type CajaMov = { time: string; concept: string; method: string; ref: string; amount: number };
export type Caja = {
  id: string;
  name: string;
  branch: string;
  operator: string;
  username: string | null;
  status: "abierta" | "cerrada";
  openTime: string;
  opening: number;
  cash: number;
  debit: number;
  credit: number;
  qr: number;
  movs: CajaMov[];
};

export const seedCajas: Caja[] = [
  {
    id: "C1", name: "Caja 1", branch: "Centro", operator: "Damián F.", username: "caja1",
    status: "abierta", openTime: "08:15", opening: 20000, cash: 149130, debit: 21400, credit: 8990, qr: 25000,
    movs: [
      { time: "14:32", concept: "Venta mostrador", method: "Efectivo", ref: "#4821", amount: 8450 },
      { time: "13:58", concept: "Venta mostrador", method: "Tarjeta déb.", ref: "#4820", amount: 12900 },
      { time: "12:10", concept: "Retiro — Gastos varios", method: "Efectivo", ref: "REC-114", amount: -5000 },
      { time: "11:44", concept: "Cobro cta. cte.", method: "Efectivo", ref: "REC-113", amount: 31200 },
    ],
  },
  {
    id: "C2", name: "Caja 2", branch: "Centro", operator: "Lucía M.", username: "caja2",
    status: "abierta", openTime: "08:20", opening: 15000, cash: 88400, debit: 12300, credit: 4100, qr: 9800,
    movs: [
      { time: "14:20", concept: "Venta mostrador", method: "QR / MP", ref: "#5310", amount: 6300 },
      { time: "13:05", concept: "Venta mostrador", method: "Efectivo", ref: "#5309", amount: 9800 },
    ],
  },
  {
    id: "CN", name: "Caja Norte", branch: "Sucursal Norte", operator: "Sin asignar", username: null,
    status: "cerrada", openTime: "—", opening: 0, cash: 0, debit: 0, credit: 0, qr: 0, movs: [],
  },
];

// ---------------------------------------------------------------------------
// Productos del POS (para Ventas + balanza)
// ---------------------------------------------------------------------------
export type PosProduct = {
  emoji: string;
  name: string;
  cat: string;
  /** por unidad */
  price?: number;
  /** por peso */
  priceKg?: number;
  weighed?: boolean;
};

export const posProducts: PosProduct[] = [
  { emoji: "🧉", name: "Yerba Playadito 1kg", cat: "Almacén", price: 2850 },
  { emoji: "🍝", name: "Fideos Matarazzo", cat: "Almacén", price: 1150 },
  { emoji: "☕", name: "Café La Virginia", cat: "Almacén", price: 4250 },
  { emoji: "🍞", name: "Pan lactal Bimbo", cat: "Almacén", price: 1980 },
  { emoji: "🥤", name: "Coca-Cola 2,25L", cat: "Bebidas", price: 2400 },
  { emoji: "🍺", name: "Cerveza Quilmes 1L", cat: "Bebidas", price: 2700 },
  { emoji: "🧻", name: "Papel higiénico x4", cat: "Limpieza", price: 3100 },
  { emoji: "🧴", name: "Detergente Magistral", cat: "Limpieza", price: 2180 },
  { emoji: "🧀", name: "Queso cremoso", cat: "Fiambres", priceKg: 7600, weighed: true },
  { emoji: "🥩", name: "Jamón cocido", cat: "Fiambres", priceKg: 9200, weighed: true },
  { emoji: "🥓", name: "Panceta ahumada", cat: "Fiambres", priceKg: 8800, weighed: true },
  { emoji: "🥗", name: "Ensalada rusa", cat: "Fiambres", priceKg: 5600, weighed: true },
];

export const posCategories = ["Todos", "Almacén", "Bebidas", "Limpieza", "Fiambres"];

// ---------------------------------------------------------------------------
// Stock (para el módulo Stock)
// ---------------------------------------------------------------------------
export type StockItem = {
  emoji: string;
  name: string;
  sku: string;
  sec: string;
  price: string;
  stk: number;
  unit: "u." | "kg";
  dailyEst: number;
  pct: number;
  level: "ok" | "low" | "crit";
  weighed?: boolean;
  pending?: number; // en camino (OC en tránsito)
};

export const stockSections = ["Todas", "Almacén", "Bebidas", "Limpieza", "Fiambres", "Lácteos", "Infusiones"];

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------
export type ProvProd = { gen: string; marca: string; cod: string; costo: number };
export type Proveedor = {
  id: string; name: string; color: string; cuit: string; tel: string; dir: string;
  pago: string; saldo: number; prods: ProvProd[];
};
export const proveedores: Proveedor[] = [
  { id: "LS", name: "La Serenísima", color: "#0F766E", cuit: "30-52418472-3", tel: "011 4555-1200", dir: "Av. Mitre 1234, Ramos Mejía", pago: "Cuenta corriente 30 días", saldo: 96300, prods: [
    { gen: "Lácteos", marca: "Leche Clásica 1L", cod: "LAC-014", costo: 940 },
    { gen: "Fiambres", marca: "Queso cremoso x kg", cod: "FIA-003", costo: 5400 },
    { gen: "Lácteos", marca: "Yogurísimo 1L", cod: "LAC-051", costo: 1180 } ] },
  { id: "DS", name: "Distrib. San Martín", color: "#B7791F", cuit: "30-71122334-9", tel: "011 4222-8890", dir: "San Martín 890, Morón", pago: "Cheque 30/60 días", saldo: 148700, prods: [
    { gen: "Yerba", marca: "Playadito 1kg", cod: "YER-001", costo: 1980 },
    { gen: "Yerba", marca: "Rosamonte 1kg", cod: "YER-004", costo: 2050 },
    { gen: "Pastas", marca: "Fideos Matarazzo 500g", cod: "ALM-041", costo: 780 },
    { gen: "Café", marca: "La Virginia 250g", cod: "ALM-077", costo: 2950 } ] },
  { id: "AM", name: "Arcor Mayorista", color: "#C0392B", cuit: "30-50012345-8", tel: "0351 488-2000", dir: "Ruta 9 km 7, Córdoba", pago: "Contado / transferencia", saldo: 54200, prods: [
    { gen: "Yerba", marca: "Playadito 1kg (mayorista)", cod: "YER-001", costo: 1890 },
    { gen: "Café", marca: "La Virginia 250g", cod: "ALM-077", costo: 2880 } ] },
  { id: "MR", name: "Molinos Río", color: "#157F52", cuit: "30-00023456-1", tel: "011 4000-1111", dir: "Uruguay 4075, Victoria", pago: "Cuenta corriente 15 días", saldo: 0, prods: [
    { gen: "Pastas", marca: "Fideos Lucchetti 500g", cod: "ALM-042", costo: 760 },
    { gen: "Aceites", marca: "Aceite Cocinero 900ml", cod: "ALM-088", costo: 2100 } ] },
];

// ---------------------------------------------------------------------------
// Compras (órdenes por artículo)
// ---------------------------------------------------------------------------
export type OCItem = { sku: string; art: string; sec: string; cant: number; costo: number };
export type Orden = { id: string; prov: string; fecha: string; estado: "Recibida" | "En tránsito" | "Borrador"; items: OCItem[] };
export const ordenes: Orden[] = [
  { id: "OC-0392", prov: "La Serenísima", fecha: "10/07", estado: "Recibida", items: [
    { sku: "LAC-014", art: "Leche La Serenísima 1L", sec: "Lácteos", cant: 100, costo: 940 },
    { sku: "FIA-003", art: "Queso cremoso x kg", sec: "Fiambres", cant: 15, costo: 5400 } ] },
  { id: "OC-0391", prov: "Distrib. San Martín", fecha: "09/07", estado: "En tránsito", items: [
    { sku: "YER-001", art: "Yerba Playadito 1kg", sec: "Almacén", cant: 120, costo: 1980 },
    { sku: "ALM-041", art: "Fideos Matarazzo 500g", sec: "Almacén", cant: 200, costo: 780 },
    { sku: "ALM-077", art: "Café La Virginia 250g", sec: "Infusiones", cant: 60, costo: 2950 } ] },
  { id: "OC-0393", prov: "Cervecería Quilmes", fecha: "11/07", estado: "En tránsito", items: [
    { sku: "BEB-020", art: "Cerveza Quilmes 1L", sec: "Bebidas", cant: 96, costo: 1850 },
    { sku: "BEB-011", art: "Coca-Cola 2,25L", sec: "Bebidas", cant: 48, costo: 1700 } ] },
  { id: "OC-0390", prov: "Molinos Río", fecha: "08/07", estado: "Borrador", items: [
    { sku: "ALM-042", art: "Fideos Lucchetti 500g", sec: "Almacén", cant: 150, costo: 760 } ] },
];

// ---------------------------------------------------------------------------
// Servicios y gastos (subcuentas + asientos)
// ---------------------------------------------------------------------------
export type Subcuenta = { id: string; emoji: string; n: string; d: string };
export const subcuentas: Subcuenta[] = [
  { id: "pub", emoji: "💡", n: "Servicios públicos", d: "Luz, agua, gas, residuos" },
  { id: "tel", emoji: "📡", n: "Telecomunicaciones", d: "Telefonía, internet, enlaces" },
  { id: "sw", emoji: "💾", n: "Software y SaaS", d: "Licencias, cloud, dominios, hosting" },
  { id: "arr", emoji: "🏢", n: "Arrendamientos", d: "Alquiler oficinas, depósitos, vehículos" },
  { id: "man", emoji: "🔧", n: "Mantenimiento", d: "Soporte, limpieza, reparaciones" },
  { id: "hon", emoji: "⚖️", n: "Honorarios", d: "Legal, contable, consultoría, marketing" },
  { id: "seg", emoji: "🛡️", n: "Seguros y vigilancia", d: "Pólizas y seguridad privada" },
];
export type Asiento = { sub: string; fe: string; fv: string; doc: string; prov: string; cuit: string; con: string; cc: string; bruto: number; iva: number; pagado: boolean };
export const asientos: Asiento[] = [
  { sub: "pub", fe: "01/07", fv: "15/07", doc: "A-0001-0009812", prov: "Edenor S.A.", cuit: "30-65511620-2", con: "Consumo eléctrico oficinas — Jul 2026", cc: "Administración", bruto: 84300, iva: 0.21, pagado: false },
  { sub: "pub", fe: "02/07", fv: "17/07", doc: "B-0004-0001120", prov: "AySA", cuit: "30-70956507-0", con: "Provisión de agua potable — Bim Jun-Jul", cc: "General", bruto: 19800, iva: 0.21, pagado: true },
  { sub: "tel", fe: "03/07", fv: "13/07", doc: "A-0002-0044210", prov: "Telecom Argentina", cuit: "30-63945373-8", con: "Internet dedicado 300MB + telefonía", cc: "Administración", bruto: 41200, iva: 0.21, pagado: false },
  { sub: "sw", fe: "05/07", fv: "05/07", doc: "INV-2026-8841", prov: "Microsoft 365", cuit: "EXT-USA", con: "Licencias Office 365 (8 usuarios)", cc: "Administración", bruto: 32000, iva: 0.21, pagado: true },
  { sub: "arr", fe: "01/07", fv: "10/07", doc: "REC-0771", prov: "Inmob. Del Centro", cuit: "20-14822905-7", con: "Alquiler local comercial — Jul 2026", cc: "General", bruto: 280000, iva: 0, pagado: true },
  { sub: "man", fe: "04/07", fv: "19/07", doc: "A-0005-0000342", prov: "TecnoService", cuit: "20-30188422-1", con: "Soporte técnico y mantenimiento", cc: "Administración", bruto: 24500, iva: 0.21, pagado: false },
  { sub: "hon", fe: "02/07", fv: "02/08", doc: "C-0001-0000088", prov: "Estudio Gómez & Asoc.", cuit: "30-70992144-5", con: "Honorarios contables y auditoría", cc: "Administración", bruto: 65000, iva: 0.21, pagado: false },
  { sub: "seg", fe: "01/07", fv: "12/07", doc: "POL-556231", prov: "La Caja Seguros", cuit: "30-50003701-8", con: "Póliza integral comercio (incendio/robo)", cc: "General", bruto: 38400, iva: 0.21, pagado: true },
];

// ---------------------------------------------------------------------------
// Clientes (cuentas corrientes)
// ---------------------------------------------------------------------------
export type Cliente = { ini: string; color: string; name: string; code: string; limite: number; saldo: number; vencido: number; ult: string; estado: [string, string] };
export const clientes: Cliente[] = [
  { ini: "KS", color: "#0F766E", name: "Kiosco El Sol", code: "CLI-0142", limite: 100000, saldo: 64300, vencido: 0, ult: "Hoy", estado: ["pill-ok", "Al día"] },
  { ini: "DR", color: "#C0392B", name: "Almacén Doña Rosa", code: "CLI-0088", limite: 80000, saldo: 87400, vencido: 87400, ult: "29/06", estado: ["pill-bad", "Vencido 12d"] },
  { ini: "PV", color: "#B7791F", name: "Panadería La Vecina", code: "CLI-0203", limite: 60000, saldo: 41900, vencido: 22100, ult: "03/07", estado: ["pill-warn", "Vencido 4d"] },
  { ini: "MC", color: "#157F52", name: "Minimercado Central", code: "CLI-0157", limite: 120000, saldo: 33300, vencido: 0, ult: "Ayer", estado: ["pill-ok", "Al día"] },
];

// ---------------------------------------------------------------------------
// Valores a depositar
// ---------------------------------------------------------------------------
export type Valor = { tipo: [string, string]; origen: string; ref: string; venc: [string, string]; importe: number };
export const valores: Valor[] = [
  { tipo: ["pill-plain", "Cheque"], origen: "Distrib. San Martín", ref: "00-1245", venc: ["pill-warn", "18/07"], importe: 54000 },
  { tipo: ["pill-plain", "Cheque"], origen: "Almacén Doña Rosa", ref: "00-0987", venc: ["pill-mute", "25/07"], importe: 91200 },
  { tipo: ["pill-blue", "Tarjeta"], origen: "Lote Posnet 0412", ref: "VISA", venc: ["pill-ok", "Acreditado"], importe: 68540 },
  { tipo: ["pill-blue", "Tarjeta"], origen: "Lote Posnet 0413", ref: "MASTER", venc: ["pill-ok", "Acreditado"], importe: 44000 },
  { tipo: ["pill-plain", "Cheque"], origen: "Panadería La Vecina", ref: "00-2210", venc: ["pill-mute", "02/08"], importe: 30000 },
  { tipo: ["pill-blue", "QR / MP"], origen: "Saldo Mercado Pago", ref: "MP", venc: ["pill-ok", "Disponible"], importe: 25000 },
];

// ---------------------------------------------------------------------------
// A pagar (obligaciones propias)
// ---------------------------------------------------------------------------
export type Cheque = { num: string; banco: string; benef: string; emis: string; venc: [string, string]; importe: number; estado: [string, string] };
export const chequesPropios: Cheque[] = [
  { num: "0045-11201", banco: "Banco Galicia", benef: "La Serenísima", emis: "05/07", venc: ["pill-bad", "14/07"], importe: 96300, estado: ["pill-warn", "A pagar"] },
  { num: "0045-11202", banco: "Banco Galicia", benef: "Distrib. San Martín", emis: "06/07", venc: ["pill-warn", "22/07"], importe: 148700, estado: ["pill-warn", "A pagar"] },
  { num: "0045-11203", banco: "Banco Nación", benef: "Molinos Río", emis: "08/07", venc: ["pill-mute", "05/08"], importe: 62000, estado: ["pill-warn", "A pagar"] },
  { num: "0045-11198", banco: "Banco Galicia", benef: "Arcor Mayorista", emis: "28/06", venc: ["pill-mute", "10/07"], importe: 35000, estado: ["pill-ok", "Pagado"] },
];
export type Credito = { entidad: string; tipo: string; cuota: number; venc: [string, string]; rest: string; saldo: number };
export const creditos: Credito[] = [
  { entidad: "Banco Galicia", tipo: "Préstamo", cuota: 84200, venc: ["pill-warn", "20/07"], rest: "7 / 12", saldo: 589400 },
  { entidad: "Tarjeta Visa Corp.", tipo: "Financiación", cuota: 28400, venc: ["pill-mute", "28/07"], rest: "2 / 3", saldo: 56800 },
];

// ---------------------------------------------------------------------------
// Caja grande (tesorería)
// ---------------------------------------------------------------------------
export type TesMov = { fecha: string; concepto: string; origen: string; tipo: [string, string]; monto: number };
export const tesoreriaMovs: TesMov[] = [
  { fecha: "11/07", concepto: "Cierre de caja — Centro", origen: "Caja diaria", tipo: ["pill-ok", "Entrada"], monto: 129130 },
  { fecha: "11/07", concepto: "Cierre de caja — Sucursal Norte", origen: "Caja diaria", tipo: ["pill-ok", "Entrada"], monto: 96400 },
  { fecha: "10/07", concepto: "Pago a proveedor — La Serenísima", origen: "Transferencia", tipo: ["pill-bad", "Salida"], monto: -96300 },
  { fecha: "10/07", concepto: "Depósito bancario — Galicia ····4471", origen: "Banco", tipo: ["pill-bad", "Salida"], monto: -282740 },
  { fecha: "10/07", concepto: "Cierre de caja — Centro", origen: "Caja diaria", tipo: ["pill-ok", "Entrada"], monto: 141900 },
];

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------
export const balanceEvol = [
  { l: "Feb", i: 410, e: 300 }, { l: "Mar", i: 445, e: 315 }, { l: "Abr", i: 470, e: 330 },
  { l: "May", i: 490, e: 340 }, { l: "Jun", i: 505, e: 348 }, { l: "Jul", i: 528, e: 361 },
];
export const balanceCats: [string, string, string, string][] = [
  ["Mercadería / proveedores", "$ 2.640.100", "73%", "var(--acc)"],
  ["Sueldos", "$ 620.000", "17%", "var(--amber)"],
  ["Servicios", "$ 218.300", "6%", "var(--cyan)"],
  ["Gastos varios", "$ 134.000", "4%", "var(--red)"],
];

// ---------------------------------------------------------------------------
// Comparativa de cajas (mensual)
// ---------------------------------------------------------------------------
export const cmpDays = 11;
export const cmpCajas = [
  { id: "C1", name: "Caja 1", suc: "Centro", color: "#39d98a", today: 184520 },
  { id: "C2", name: "Caja 2", suc: "Centro", color: "#57d7ea", today: 140500 },
  { id: "CN", name: "Caja Norte", suc: "Norte", color: "#f5b23d", today: 0 },
];

export const stockItems: StockItem[] = [
  { emoji: "🧉", name: "Yerba Playadito 1kg", sku: "YER-001", sec: "Almacén", price: "2.850", stk: 3, unit: "u.", dailyEst: 14, pct: 6, level: "crit", pending: 120 },
  { emoji: "🍝", name: "Fideos Matarazzo", sku: "ALM-041", sec: "Almacén", price: "1.150", stk: 210, unit: "u.", dailyEst: 22, pct: 60, level: "ok" },
  { emoji: "☕", name: "Café La Virginia", sku: "ALM-077", sec: "Infusiones", price: "4.250", stk: 41, unit: "u.", dailyEst: 8, pct: 18, level: "low", pending: 60 },
  { emoji: "🥤", name: "Coca-Cola 2,25L", sku: "BEB-011", sec: "Bebidas", price: "2.400", stk: 96, unit: "u.", dailyEst: 31, pct: 44, level: "ok", pending: 48 },
  { emoji: "🍺", name: "Cerveza Quilmes 1L", sku: "BEB-020", sec: "Bebidas", price: "2.700", stk: 2, unit: "u.", dailyEst: 18, pct: 4, level: "crit", pending: 96 },
  { emoji: "🧻", name: "Papel higiénico x4", sku: "LIM-088", sec: "Limpieza", price: "3.100", stk: 54, unit: "u.", dailyEst: 9, pct: 22, level: "low" },
  { emoji: "🧴", name: "Detergente Magistral", sku: "LIM-090", sec: "Limpieza", price: "2.180", stk: 88, unit: "u.", dailyEst: 7, pct: 70, level: "ok" },
  { emoji: "🧀", name: "Queso cremoso", sku: "FIA-003", sec: "Fiambres", price: "7.600", stk: 19, unit: "kg", dailyEst: 6, pct: 48, level: "ok", weighed: true },
  { emoji: "🥩", name: "Jamón cocido", sku: "FIA-005", sec: "Fiambres", price: "9.200", stk: 12, unit: "kg", dailyEst: 5, pct: 35, level: "ok", weighed: true },
  { emoji: "🥓", name: "Panceta ahumada", sku: "FIA-006", sec: "Fiambres", price: "8.800", stk: 4, unit: "kg", dailyEst: 3, pct: 18, level: "low", weighed: true },
  { emoji: "🥛", name: "Leche La Serenísima", sku: "LAC-014", sec: "Lácteos", price: "1.320", stk: 128, unit: "u.", dailyEst: 44, pct: 35, level: "ok" },
];

