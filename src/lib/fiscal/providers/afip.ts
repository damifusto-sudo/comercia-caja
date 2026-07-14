import type { FiscalConfig, FiscalInvoice, FiscalProvider, FiscalResult } from "../types";
import { afipDate, ivaCodeFor } from "../codes";

// Endpoints AFIP
const WSAA = {
  homologacion: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  produccion: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
};
const WSFE = {
  homologacion: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  produccion: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
};

type TA = { token: string; sign: string; exp: number };
// Cache en memoria del Ticket de Acceso (válido ~12h). AFIP rechaza pedir uno
// nuevo mientras haya uno vigente, así que conviene reusarlo por CUIT+ambiente.
const taCache = new Map<string, TA>();

/**
 * Proveedor AFIP directo (WSAA + WSFEv1). Requiere el certificado + clave PEM de
 * la org. La firma CMS del TRA usa `node-forge` (import dinámico: si no está
 * instalado, devuelve un error accionable en vez de romper el build). Pensado
 * como fundación: la lógica de armado/parseo es completa; conviene probarlo en
 * HOMOLOGACIÓN con el certificado del cliente antes de producción.
 */
export class AfipProvider implements FiscalProvider {
  readonly kind = "afip" as const;

  constructor(private readonly cfg: FiscalConfig) {}

  private endpointWSAA() { return WSAA[this.cfg.environment]; }
  private endpointWSFE() { return WSFE[this.cfg.environment]; }

  // -- WSAA: firma el TRA (CMS) y obtiene Token + Sign -----------------------
  private buildTRA(service = "wsfe"): string {
    const now = new Date();
    const gen = new Date(now.getTime() - 60_000);
    const exp = new Date(now.getTime() + 10 * 60_000);
    const uid = Math.floor(now.getTime() / 1000);
    const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "-00:00");
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<loginTicketRequest version="1.0">` +
      `<header><uniqueId>${uid}</uniqueId>` +
      `<generationTime>${iso(gen)}</generationTime>` +
      `<expirationTime>${iso(exp)}</expirationTime></header>` +
      `<service>${service}</service></loginTicketRequest>`
    );
  }

  private async signCMS(tra: string): Promise<string> {
    if (!this.cfg.certPem || !this.cfg.keyPem) {
      throw new Error("Falta el certificado o la clave (PEM) de AFIP en la configuración de la org.");
    }
    // Import dinámico con especificador en variable: tsc no lo resuelve estáticamente,
    // así que el build no exige tener 'node-forge' instalado.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let forge: any;
    try {
      const mod = "node-forge";
      forge = await import(mod);
    } catch {
      throw new Error("Falta la dependencia 'node-forge' para firmar el TRA (npm i node-forge). Alternativa: usar proveedor 'external'.");
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, "utf8");
    const cert = forge.pki.certificateFromPem(this.cfg.certPem);
    const key = forge.pki.privateKeyFromPem(this.cfg.keyPem);
    p7.addCertificate(cert);
    p7.addSigner({
      key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date().toString() },
      ],
    });
    p7.sign({ detached: false });
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return forge.util.encode64(der);
  }

  private async getTA(): Promise<TA> {
    const key = `${this.cfg.environment}:${this.cfg.cuit}`;
    const cached = taCache.get(key);
    if (cached && cached.exp > Date.now() + 60_000) return cached;

    const cms = await this.signCMS(this.buildTRA("wsfe"));
    const env =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
      `<soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
    const r = await fetch(this.endpointWSAA(), {
      method: "POST",
      headers: { "content-type": "text/xml; charset=utf-8", soapaction: "" },
      body: env,
    });
    const xml = await r.text();
    const decoded = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const token = /<token>([\s\S]*?)<\/token>/.exec(decoded)?.[1];
    const sign = /<sign>([\s\S]*?)<\/sign>/.exec(decoded)?.[1];
    const expText = /<expirationTime>([\s\S]*?)<\/expirationTime>/.exec(decoded)?.[1];
    if (!token || !sign) throw new Error(`WSAA sin token/sign: ${xml.slice(0, 300)}`);
    const ta: TA = { token, sign, exp: expText ? Date.parse(expText) : Date.now() + 11 * 3600_000 };
    taCache.set(key, ta);
    return ta;
  }

  // -- WSFEv1 ----------------------------------------------------------------
  private authHeader(ta: TA): string {
    return `<ar:Auth><ar:Token>${ta.token}</ar:Token><ar:Sign>${ta.sign}</ar:Sign><ar:Cuit>${this.cfg.cuit}</ar:Cuit></ar:Auth>`;
  }

  private async soapWSFE(action: string, bodyInner: string): Promise<string> {
    const env =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">` +
      `<soapenv:Body>${bodyInner}</soapenv:Body></soapenv:Envelope>`;
    const r = await fetch(this.endpointWSFE(), {
      method: "POST",
      headers: { "content-type": "text/xml; charset=utf-8", soapaction: `http://ar.gov.afip.dif.FEV1/${action}` },
      body: env,
    });
    return r.text();
  }

  async lastAuthorized(posNumber: number, cbteTipo: number): Promise<number> {
    const ta = await this.getTA();
    const inner =
      `<ar:FECompUltimoAutorizado>${this.authHeader(ta)}` +
      `<ar:PtoVta>${posNumber}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`;
    const xml = await this.soapWSFE("FECompUltimoAutorizado", inner);
    return Number(/<CbteNro>(\d+)<\/CbteNro>/.exec(xml)?.[1] ?? 0);
  }

  async authorize(invoice: FiscalInvoice): Promise<FiscalResult> {
    try {
      const ta = await this.getTA();
      const next = (await this.lastAuthorized(invoice.posNumber, invoice.cbteTipo)) + 1;

      const alic = (invoice.vatBreakdown && invoice.vatBreakdown.length
        ? invoice.vatBreakdown
        : [{ rate: 21, net: invoice.net, vat: invoice.vat }]
      )
        .filter((a) => a.vat > 0 || a.net > 0)
        .map(
          (a) =>
            `<ar:AlicIva><ar:Id>${ivaCodeFor(a.rate)}</ar:Id>` +
            `<ar:BaseImp>${a.net.toFixed(2)}</ar:BaseImp><ar:Importe>${a.vat.toFixed(2)}</ar:Importe></ar:AlicIva>`,
        )
        .join("");

      const { docTipoFor } = await import("../codes");
      const { docTipo, docNro } = docTipoFor(invoice.clientTaxCondition, invoice.clientTaxId);
      const ivaBlock = invoice.vat > 0 ? `<ar:Iva>${alic}</ar:Iva>` : "";

      const det =
        `<ar:FECAEDetRequest>` +
        `<ar:Concepto>${invoice.concept}</ar:Concepto>` +
        `<ar:DocTipo>${docTipo}</ar:DocTipo><ar:DocNro>${docNro}</ar:DocNro>` +
        `<ar:CbteDesde>${next}</ar:CbteDesde><ar:CbteHasta>${next}</ar:CbteHasta>` +
        `<ar:CbteFch>${afipDate(invoice.docDate)}</ar:CbteFch>` +
        `<ar:ImpTotal>${invoice.total.toFixed(2)}</ar:ImpTotal>` +
        `<ar:ImpTotConc>0</ar:ImpTotConc>` +
        `<ar:ImpNeto>${invoice.net.toFixed(2)}</ar:ImpNeto>` +
        `<ar:ImpOpEx>0</ar:ImpOpEx>` +
        `<ar:ImpIVA>${invoice.vat.toFixed(2)}</ar:ImpIVA>` +
        `<ar:ImpTrib>0</ar:ImpTrib>` +
        `<ar:MonId>${invoice.currency}</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>` +
        ivaBlock +
        `</ar:FECAEDetRequest>`;

      const inner =
        `<ar:FECAESolicitar>${this.authHeader(ta)}<ar:FeCAEReq>` +
        `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${invoice.posNumber}</ar:PtoVta><ar:CbteTipo>${invoice.cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
        `<ar:FeDetReq>${det}</ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>`;

      const xml = await this.soapWSFE("FECAESolicitar", inner);
      const resultado = /<Resultado>(\w)<\/Resultado>/.exec(xml)?.[1];
      const cae = /<CAE>(\d+)<\/CAE>/.exec(xml)?.[1];
      const caeVto = /<CAEFchVto>(\d{8})<\/CAEFchVto>/.exec(xml)?.[1];

      if (resultado === "A" && cae) {
        const due = caeVto ? `${caeVto.slice(0, 4)}-${caeVto.slice(4, 6)}-${caeVto.slice(6, 8)}` : undefined;
        return { authorized: true, cae, caeDue: due, cbteNro: next, raw: xml };
      }
      // Observaciones / errores de AFIP
      const obs = [...xml.matchAll(/<Msg>([\s\S]*?)<\/Msg>/g)].map((m) => m[1]).join(" · ");
      return { authorized: false, error: obs || `AFIP rechazó el comprobante (Resultado ${resultado ?? "?"})`, raw: xml };
    } catch (e) {
      return { authorized: false, error: e instanceof Error ? e.message : "Error autorizando con AFIP" };
    }
  }
}
