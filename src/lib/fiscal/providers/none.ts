import type { FiscalProvider, FiscalResult } from "../types";

/**
 * Proveedor interno: numeración propia, SIN CAE (comprobante no fiscal). Es el
 * comportamiento por defecto hasta que la org conecte AFIP.
 */
export class NoneProvider implements FiscalProvider {
  readonly kind = "none" as const;

  async lastAuthorized(): Promise<number> {
    return 0;
  }

  async authorize(): Promise<FiscalResult> {
    return { authorized: false, error: "Sin proveedor fiscal: comprobante interno (no fiscal)." };
  }
}
