// ============================================================================
// Comercia · Mapeos AFIP (WSFEv1) — puros y testeables, sin I/O
//  Tablas de códigos oficiales de AFIP para armar el pedido de CAE.
// ============================================================================

export type Letter = "A" | "B" | "C";
export type CbteKind = "factura" | "nota_debito" | "nota_credito";

/** Tipo de comprobante AFIP según letra + clase. */
export function cbteTipoFor(letter: Letter, kind: CbteKind = "factura"): number {
  const table: Record<CbteKind, Record<Letter, number>> = {
    factura: { A: 1, B: 6, C: 11 },
    nota_debito: { A: 2, B: 7, C: 12 },
    nota_credito: { A: 3, B: 8, C: 13 },
  };
  return table[kind][letter];
}

/** Documento del receptor: 80=CUIT, 96=DNI, 99=Consumidor Final (sin identificar). */
export function docTipoFor(taxCondition: string, taxId: string | null): { docTipo: number; docNro: number } {
  const digits = (taxId ?? "").replace(/\D/g, "");
  if (taxCondition === "responsable_inscripto" || taxCondition === "monotributo" || digits.length === 11) {
    return { docTipo: 80, docNro: Number(digits || 0) }; // CUIT
  }
  if (digits.length >= 7 && digits.length <= 8) {
    return { docTipo: 96, docNro: Number(digits) }; // DNI
  }
  return { docTipo: 99, docNro: 0 }; // Consumidor Final
}

/** Id de alícuota de IVA de AFIP. */
export function ivaCodeFor(rate: number): number {
  switch (Math.round(rate * 100) / 100) {
    case 0: return 3; // 0%
    case 10.5: return 4; // 10,5%
    case 21: return 5; // 21%
    case 27: return 6; // 27%
    case 5: return 8; // 5%
    case 2.5: return 9; // 2,5%
    default: return 5;
  }
}

/** Concepto del comprobante. */
export const CONCEPT = { PRODUCTOS: 1, SERVICIOS: 2, AMBOS: 3 } as const;

/** Letra desde el tipo de comprobante AFIP. */
export function letterFromCbteTipo(cbteTipo: number): Letter {
  if ([1, 2, 3].includes(cbteTipo)) return "A";
  if ([6, 7, 8].includes(cbteTipo)) return "B";
  return "C";
}

/** Número formateado "B 0001-00000123". */
export function formatNumber(letter: Letter, posNumber: number, seq: number): string {
  return `${letter} ${String(posNumber).padStart(4, "0")}-${String(seq).padStart(8, "0")}`;
}

/** Fecha yyyymmdd (formato AFIP) desde 'yyyy-mm-dd'. */
export function afipDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}
