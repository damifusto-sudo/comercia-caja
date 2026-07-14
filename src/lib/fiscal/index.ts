import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiscalConfig, FiscalInvoice, FiscalProvider, FiscalResult } from "./types";
import { NoneProvider } from "./providers/none";
import { ExternalGatewayProvider } from "./providers/external";
import { AfipProvider } from "./providers/afip";
import { formatNumber, letterFromCbteTipo } from "./codes";

export * from "./types";
export * from "./codes";

/** Devuelve el proveedor fiscal según la config de la org. */
export function getFiscalProvider(cfg: FiscalConfig): FiscalProvider {
  if (!cfg.enabled || cfg.provider === "none") return new NoneProvider();
  if (cfg.provider === "external") return new ExternalGatewayProvider(cfg);
  if (cfg.provider === "afip") return new AfipProvider(cfg);
  return new NoneProvider();
}

/** Lee la config fiscal de una org (incluye la clave privada → SÓLO server). */
export async function loadFiscalConfig(
  supabase: SupabaseClient,
  orgId: string,
): Promise<FiscalConfig | null> {
  const { data } = await supabase.from("fiscal_config").select("*").eq("org_id", orgId).maybeSingle();
  if (!data) return null;
  return {
    provider: data.provider,
    environment: data.environment,
    cuit: data.cuit,
    posNumber: data.pos_number,
    certPem: data.cert_pem,
    keyPem: data.key_pem,
    gatewayUrl: data.gateway_url,
    apiToken: data.api_token,
    enabled: data.enabled,
  };
}

/**
 * Autoriza un comprobante pendiente: arma el `FiscalInvoice`, llama al proveedor
 * (AFIP/gateway) y estampa el CAE (o el rechazo) vía la RPC `stamp_cae`. Toda la
 * llamada externa ocurre acá, en el server.
 */
export async function authorizeDocument(supabase: SupabaseClient, docId: string): Promise<FiscalResult> {
  const { data: doc } = await supabase
    .from("documents")
    .select("id, org_id, cbte_tipo, pos_number, doc_date, net, vat, total, party_id, fiscal_status")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { authorized: false, error: "Documento no encontrado" };
  if (doc.fiscal_status !== "pendiente") {
    return { authorized: false, error: `El comprobante no está pendiente (${doc.fiscal_status})` };
  }

  const cfg = await loadFiscalConfig(supabase, doc.org_id);
  if (!cfg) return { authorized: false, error: "La organización no tiene configuración fiscal" };

  const { data: party } = await supabase
    .from("parties")
    .select("tax_condition, tax_id")
    .eq("id", doc.party_id)
    .maybeSingle();

  const posNumber = doc.pos_number ?? cfg.posNumber;
  const invoice: FiscalInvoice = {
    cbteTipo: doc.cbte_tipo,
    posNumber,
    docDate: String(doc.doc_date),
    net: Number(doc.net),
    vat: Number(doc.vat),
    total: Number(doc.total),
    concept: 1, // productos
    clientTaxCondition: party?.tax_condition ?? "consumidor_final",
    clientTaxId: party?.tax_id ?? null,
    currency: "PES",
    vatBreakdown: [{ rate: 21, net: Number(doc.net), vat: Number(doc.vat) }],
  };

  const result = await getFiscalProvider(cfg).authorize(invoice);

  const number =
    result.authorized && result.cbteNro
      ? formatNumber(letterFromCbteTipo(doc.cbte_tipo), posNumber, result.cbteNro)
      : null;

  await supabase.rpc("stamp_cae", {
    p_doc: docId,
    p_status: result.authorized ? "autorizado" : "rechazado",
    p_cae: result.cae ?? null,
    p_cae_due: result.caeDue ?? null,
    p_number: number,
    p_error: result.authorized ? null : result.error ?? "Rechazado",
  });

  return { ...result, number: number ?? result.number };
}
