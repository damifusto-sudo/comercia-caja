import type { FiscalConfig, FiscalInvoice, FiscalProvider, FiscalResult } from "../types";

/**
 * Proveedor 'external': delega la autorización en un gateway HTTP propio del
 * cliente (su microservicio AFIP, o un SaaS como AFIP SDK / TusFacturas / etc.).
 * Es el camino más genérico para "conectar cada cliente": la org configura una
 * URL + token y este provider le manda el comprobante normalizado y espera
 * { cae, caeDue, cbteNro }. Funciona hoy contra cualquier gateway compatible.
 *
 * Contrato esperado del gateway:
 *   POST {gatewayUrl}/last     { posNumber, cbteTipo }        -> { last: number }
 *   POST {gatewayUrl}/authorize { ...FiscalInvoice }          -> { authorized, cae, caeDue, cbteNro, error? }
 *   (Authorization: Bearer {apiToken} si hay token)
 */
export class ExternalGatewayProvider implements FiscalProvider {
  readonly kind = "external" as const;

  constructor(private readonly cfg: FiscalConfig) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.apiToken) h["authorization"] = `Bearer ${this.cfg.apiToken}`;
    return h;
  }

  private base(): string {
    const url = (this.cfg.gatewayUrl ?? "").replace(/\/+$/, "");
    if (!url) throw new Error("Gateway fiscal sin URL configurada");
    return url;
  }

  async lastAuthorized(posNumber: number, cbteTipo: number): Promise<number> {
    const r = await fetch(`${this.base()}/last`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ posNumber, cbteTipo, cuit: this.cfg.cuit, environment: this.cfg.environment }),
    });
    if (!r.ok) throw new Error(`Gateway /last ${r.status}`);
    const j = (await r.json()) as { last?: number };
    return Number(j.last ?? 0);
  }

  async authorize(invoice: FiscalInvoice): Promise<FiscalResult> {
    try {
      const r = await fetch(`${this.base()}/authorize`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ ...invoice, cuit: this.cfg.cuit, environment: this.cfg.environment }),
      });
      const j = (await r.json().catch(() => ({}))) as Partial<FiscalResult>;
      if (!r.ok || !j.authorized) {
        return { authorized: false, error: j.error ?? `Gateway /authorize ${r.status}`, raw: j };
      }
      return {
        authorized: true,
        cae: j.cae,
        caeDue: j.caeDue,
        cbteNro: j.cbteNro,
        raw: j,
      };
    } catch (e) {
      return { authorized: false, error: e instanceof Error ? e.message : "Error de red con el gateway fiscal" };
    }
  }
}
