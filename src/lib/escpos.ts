// ============================================================================
// Comercia · Generador de comandos ESC/POS para impresoras térmicas (80/58 mm)
//  Puro (sin hardware): compone un Uint8Array con los bytes que se envían por
//  WebUSB. Incluye QR nativo (GS ( k). El texto se pasa a ASCII (sin acentos)
//  para evitar problemas de code page entre modelos — estándar en tickets.
// ============================================================================

const ESC = 0x1b;
const GS = 0x1d;

// Acentos → ASCII (los tickets térmicos suelen imprimirse sin acentos)
function toAscii(s: string): string {
  return s
    .replace(/[áàäâã]/g, "a").replace(/[ÁÀÄÂÃ]/g, "A")
    .replace(/[éèëê]/g, "e").replace(/[ÉÈËÊ]/g, "E")
    .replace(/[íìïî]/g, "i").replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[óòöôõ]/g, "o").replace(/[ÓÒÖÔÕ]/g, "O")
    .replace(/[úùüû]/g, "u").replace(/[ÚÙÜÛ]/g, "U")
    .replace(/ñ/g, "n").replace(/Ñ/g, "N")
    .replace(/[°º]/g, "o").replace(/[^\x20-\x7E\n]/g, "");
}

export class Escpos {
  private buf: number[] = [];

  push(...b: number[]) { this.buf.push(...b); return this; }
  raw(bytes: number[]) { this.buf.push(...bytes); return this; }

  init() { return this.push(ESC, 0x40); }                         // ESC @
  align(a: "left" | "center" | "right") { return this.push(ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0); }
  bold(on: boolean) { return this.push(ESC, 0x45, on ? 1 : 0); }
  /** size: 1 = normal, 2 = doble alto y ancho, 3 = doble alto */
  size(mode: 1 | 2 | 3) { const n = mode === 2 ? 0x11 : mode === 3 ? 0x01 : 0x00; return this.push(GS, 0x21, n); }

  text(s: string) {
    const a = toAscii(s);
    for (let i = 0; i < a.length; i++) this.buf.push(a.charCodeAt(i) & 0xff);
    return this;
  }
  line(s = "") { return this.text(s).push(0x0a); }
  feed(n = 1) { return this.push(ESC, 0x64, n); }                 // ESC d n

  /** Dos columnas justificadas al ancho del papel (default 48 cols = 80 mm). */
  row(left: string, right: string, cols = 48) {
    const l = toAscii(left), r = toAscii(right);
    const space = Math.max(1, cols - l.length - r.length);
    return this.line(l + " ".repeat(space) + r);
  }
  rule(cols = 48) { return this.line("-".repeat(cols)); }

  /** QR nativo ESC/POS. size 1..16 (módulo), ec: 48..51 (L,M,Q,H). */
  qr(data: string, size = 6, ec = 49) {
    const bytes = Array.from(data).map((c) => c.charCodeAt(0) & 0xff);
    const model = [GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00];
    const setSize = [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size];
    const setEc = [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ec];
    const len = bytes.length + 3;
    const store = [GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...bytes];
    const print = [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30];
    return this.raw(model).raw(setSize).raw(setEc).raw(store).raw(print);
  }

  cut() { return this.push(GS, 0x56, 0x42, 0x00); }               // corte parcial con avance

  build(): Uint8Array { return new Uint8Array(this.buf); }
}
