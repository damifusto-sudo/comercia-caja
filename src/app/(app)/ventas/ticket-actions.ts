"use server";

import { createClient } from "@/lib/supabase/server";
import { docTipoFor } from "@/lib/fiscal/codes";
import type { TicketData } from "@/lib/ticket";

const fmtDate = (s: string) => {
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/**
 * Datos de un comprobante para imprimir. Usa la RPC `get_ticket` (definer) para
 * que el cajero pueda obtener su propio ticket pese a la RLS de lectura, y arma
 * el QR de AFIP (RG 4892) cuando el comprobante tiene CAE.
 */
export async function getTicketData(docId: string, method = "—"): Promise<{ ok: boolean; error?: string; data?: TicketData }> {
  if (!docId) return { ok: false, error: "Falta el comprobante" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ticket", { p_doc: docId });
  if (error) return { ok: false, error: error.message };

  const r = (data ?? {}) as {
    ok: boolean; error?: string;
    doc?: { letter: string; number: string; doc_date: string; net: number; vat: number; total: number;
      cbte_tipo: number; pos_number: number; seq: number; cae: string | null; cae_due: string | null; fiscal_status: string };
    org?: { name: string; legal_name: string | null; cuit: string | null; tax_condition: string; address: string | null; gross_income: string | null };
    party?: { name: string; tax_condition: string; tax_id: string | null };
    lines?: { concept: string; qty: number; unit_price: number; line_total: number }[];
  };
  if (!r.ok || !r.doc) return { ok: false, error: r.error ?? "Comprobante no encontrado" };

  const doc = r.doc;
  const emisorCuit = r.org?.cuit ?? null;

  // QR de AFIP (RG 4892) — sólo con CAE
  let qrUrl: string | null = null;
  if (doc.cae && emisorCuit) {
    const { docTipo, docNro } = docTipoFor(r.party?.tax_condition ?? "consumidor_final", r.party?.tax_id ?? null);
    const payload = {
      ver: 1, fecha: String(doc.doc_date).slice(0, 10),
      cuit: Number(String(emisorCuit).replace(/\D/g, "")),
      ptoVta: doc.pos_number ?? 1, tipoCmp: doc.cbte_tipo ?? 6, nroCmp: doc.seq ?? 0,
      importe: Number(doc.total), moneda: "PES", ctz: 1,
      tipoDocRec: docTipo, nroDocRec: docNro, tipoCodAut: "E", codAut: Number(doc.cae),
    };
    qrUrl = "https://www.afip.gob.ar/fe/qr/?p=" + Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  const td: TicketData = {
    commerce: {
      name: r.org?.name ?? "Comercio", legalName: r.org?.legal_name ?? null, cuit: emisorCuit,
      taxCondition: r.org?.tax_condition ?? "responsable_inscripto",
      address: r.org?.address ?? null, grossIncome: r.org?.gross_income ?? null,
    },
    number: doc.number ?? "", letter: doc.letter ?? "B", date: fmtDate(doc.doc_date),
    client: r.party?.name ?? "Consumidor Final",
    items: (r.lines ?? []).map((l) => ({
      name: l.concept ?? "Item", qty: Number(l.qty), unit: "u",
      unitPrice: Number(l.unit_price), total: Number(l.line_total),
    })),
    net: Number(doc.net), vat: Number(doc.vat), total: Number(doc.total),
    method,
    cae: doc.cae ?? null, caeDue: doc.cae_due ? fmtDate(doc.cae_due) : null,
    qrUrl, fiscal: doc.fiscal_status ?? "no_fiscal",
  };
  return { ok: true, data: td };
}
