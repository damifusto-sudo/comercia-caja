import { Escpos } from "./escpos";

export type TicketItem = { name: string; qty: number; unit: string; unitPrice: number; total: number };
export type TicketData = {
  commerce: { name: string; legalName?: string | null; cuit: string | null; taxCondition: string; address?: string | null; grossIncome?: string | null };
  number: string; // "B 0001-00000012"
  letter: string; // A/B/C
  date: string; // dd/mm/yyyy
  client: string;
  items: TicketItem[];
  net: number; vat: number; total: number;
  method: string; // etiqueta del medio de pago
  cae: string | null; caeDue: string | null;
  qrUrl: string | null; // QR AFIP (RG 4892) cuando hay CAE
  fiscal: string; // no_fiscal | pendiente | autorizado | rechazado
};

const COLS = 48; // 80 mm ≈ 48 columnas (usar 32 para 58 mm)
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const qtyStr = (q: number, u: string) => (u === "kg" ? q.toFixed(3) : String(Math.round(q))) + " " + u;

const CONDICION: Record<string, string> = {
  responsable_inscripto: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
};

/** Compone el ticket ESC/POS (80 mm) listo para enviar a la impresora térmica. */
export function composeTicket(d: TicketData, cols = COLS): Uint8Array {
  const p = new Escpos().init();

  p.align("center").bold(true).size(2).line(d.commerce.name).size(1).bold(false);
  if (d.commerce.legalName) p.line(d.commerce.legalName);
  if (d.commerce.cuit) p.line("CUIT " + d.commerce.cuit);
  p.line(CONDICION[d.commerce.taxCondition] ?? d.commerce.taxCondition);
  if (d.commerce.address) p.line(d.commerce.address);
  if (d.commerce.grossIncome) p.line("IIBB: " + d.commerce.grossIncome);
  p.rule(cols);

  p.align("left").bold(true).size(2).line("FACTURA " + d.letter).size(1).bold(false);
  p.line(d.number);
  p.row("Fecha: " + d.date, d.client, cols);
  p.rule(cols);

  for (const it of d.items) {
    p.line(it.name);
    p.row("  " + qtyStr(it.qty, it.unit) + " x " + money(it.unitPrice), money(it.total), cols);
  }
  p.rule(cols);

  p.row("Neto gravado", money(d.net), cols);
  p.row("IVA 21%", money(d.vat), cols);
  p.bold(true).size(2).row("TOTAL", money(d.total), Math.floor(cols / 2)).size(1).bold(false);
  p.row("Medio de pago", d.method, cols);
  p.rule(cols);

  if (d.cae) {
    p.line("CAE: " + d.cae);
    if (d.caeDue) p.line("Vto. CAE: " + d.caeDue);
    if (d.qrUrl) p.align("center").feed(1).qr(d.qrUrl, 6).align("left");
  } else if (d.fiscal === "pendiente") {
    p.align("center").line("Comprobante pendiente de CAE (AFIP)").align("left");
  } else {
    p.align("center").line("Comprobante interno (no fiscal)").align("left");
  }

  p.feed(1).align("center").line("Gracias por su compra").feed(3).cut();
  return p.build();
}
