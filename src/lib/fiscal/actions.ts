"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { authorizeDocument } from "./index";
import type { FiscalConfig } from "./types";

/**
 * Solicita el CAE de un comprobante pendiente (llama a AFIP/gateway y estampa el
 * resultado). Se puede llamar justo después de emitir la factura, o en diferido
 * sobre la cola de `fiscal_status='pendiente'`.
 */
export async function authorizeInvoice(docId: string): Promise<{
  ok: boolean; error?: string; cae?: string; caeDue?: string; number?: string;
}> {
  if (!docId) return { ok: false, error: "Falta el documento" };
  const supabase = await createClient();
  const res = await authorizeDocument(supabase, docId);
  revalidatePath("/ventas");
  revalidatePath("/cuentas");
  return { ok: res.authorized, error: res.error, cae: res.cae, caeDue: res.caeDue, number: res.number };
}

/**
 * Conecta (o actualiza) la configuración fiscal de la org: acá cada cliente pone
 * su proveedor, CUIT, punto de venta y credenciales (certificado+clave PEM para
 * AFIP directo, o URL+token para gateway externo). Sólo owner/admin.
 */
export async function saveFiscalConfig(input: Partial<FiscalConfig>): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: "Sólo owner/admin puede configurar AFIP" };

  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_config").upsert({
    org_id: ctx.orgId,
    provider: input.provider ?? "none",
    environment: input.environment ?? "homologacion",
    cuit: input.cuit ?? null,
    pos_number: input.posNumber ?? 1,
    cert_pem: input.certPem ?? null,
    key_pem: input.keyPem ?? null,
    gateway_url: input.gatewayUrl ?? null,
    api_token: input.apiToken ?? null,
    enabled: input.enabled ?? false,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ventas");
  return { ok: true };
}
