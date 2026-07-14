// ============================================================================
// Comercia · Capa fiscal (AFIP) genérica y multi-tenant
//  Abstracción `FiscalProvider`: cada org (cliente del SaaS) conecta su propio
//  proveedor. Implementaciones: 'none' (interno, sin CAE), 'external' (gateway
//  HTTP propio del cliente) y 'afip' (WSAA + WSFEv1 directo con su certificado).
//  La autorización corre SIEMPRE en el server (nunca en el cliente ni en la DB).
// ============================================================================

export type FiscalProviderKind = "none" | "afip" | "external";
export type FiscalEnv = "homologacion" | "produccion";

/** Config fiscal de una org (fila de fiscal_config). key_pem/api_token son SÓLO server. */
export type FiscalConfig = {
  provider: FiscalProviderKind;
  environment: FiscalEnv;
  cuit: string | null;
  posNumber: number;
  certPem?: string | null;
  keyPem?: string | null;
  gatewayUrl?: string | null;
  apiToken?: string | null;
  enabled: boolean;
};

/** Comprobante normalizado que se envía a autorizar. */
export type FiscalInvoice = {
  cbteTipo: number; // AFIP: 1=FacA, 6=FacB, 11=FacC, ...
  posNumber: number;
  docDate: string; // yyyy-mm-dd
  net: number; // neto gravado
  vat: number; // IVA
  total: number; // total
  concept: number; // 1 productos, 2 servicios, 3 ambos
  clientTaxCondition: string; // tax_condition del cliente
  clientTaxId: string | null; // CUIT/DNI (sin formato)
  currency: string; // 'PES'
  /** desglose por alícuota (para AlicIva de WSFEv1) */
  vatBreakdown?: Array<{ rate: number; net: number; vat: number }>;
};

/** Resultado de la autorización. */
export type FiscalResult = {
  authorized: boolean;
  cae?: string;
  caeDue?: string; // yyyy-mm-dd
  cbteNro?: number; // número autorizado por AFIP
  number?: string; // número formateado "B 0001-00000123"
  error?: string;
  raw?: unknown;
};

export interface FiscalProvider {
  readonly kind: FiscalProviderKind;
  /** Último comprobante autorizado por AFIP para (punto de venta, tipo). 0 si no hay. */
  lastAuthorized(posNumber: number, cbteTipo: number): Promise<number>;
  /** Solicita el CAE de un comprobante. */
  authorize(invoice: FiscalInvoice): Promise<FiscalResult>;
}
