"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Integración de balanza GENÉRICA vía Web Serial API (Chrome/Edge, en HTTPS o
 * localhost). Sirve para la mayoría de las balanzas de mostrador que emiten un
 * flujo ASCII continuo con el peso (Kretz, Systel, CAS, etc.).
 *
 *  - connect(): pide permiso al puerto serie y empieza a leer el peso en vivo.
 *  - Si no hay balanza conectada (o el navegador no soporta Web Serial), cae a
 *    una SIMULACIÓN para poder usar/demostrar el POS sin hardware.
 *  - parseWeight() es un parser tolerante: toma el último número decimal de cada
 *    trama y normaliza kg / gramos. Cuando tengas la balanza física se ajusta el
 *    baudRate y, si hiciera falta, el patrón exacto de su protocolo.
 */

export type ScaleOptions = {
  baudRate?: number; // típico: 9600 (también 2400 / 4800)
  simulate?: boolean; // permitir simulación cuando no hay balanza (default: true)
};

// Extrae el peso (en kg) de una línea del protocolo de la balanza.
function parseWeight(line: string): number | null {
  const tokens = line.match(/-?\d+(?:[.,]\d+)?/g);
  if (!tokens || tokens.length === 0) return null;
  const raw = tokens[tokens.length - 1]; // el peso suele ser el último número de la trama
  const hasDecimal = /[.,]/.test(raw);
  let n = parseFloat(raw.replace(",", "."));
  if (!isFinite(n)) return null;
  // Heurística genérica: enteros grandes sin decimales suelen venir en gramos.
  if (!hasDecimal && Math.abs(n) >= 100) n = n / 1000;
  return n < 0 ? 0 : Math.round(n * 1000) / 1000;
}

type SerialLike = {
  requestPort: () => Promise<SerialPortLike>;
  getPorts?: () => Promise<SerialPortLike[]>;
};
type SerialPortLike = {
  open: (o: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

export function useScale(opts: ScaleOptions = {}) {
  const { baudRate = 9600, simulate = true } = opts;
  const [weight, setWeight] = useState(0);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("Simulada");
  const supported = typeof navigator !== "undefined" && "serial" in navigator;

  const portRef = useRef<SerialPortLike | null>(null);
  const keepReading = useRef(false);
  const target = useRef(0.842);
  const ticks = useRef(0);

  // Simulación (sólo cuando no hay balanza real conectada)
  useEffect(() => {
    if (connected || !simulate) return;
    setStatus(supported ? "Simulada · conectá tu balanza" : "Simulada (navegador sin Web Serial)");
    setWeight(0.842);
    target.current = 0.842;
    const id = setInterval(() => {
      ticks.current++;
      if (ticks.current % 18 === 0) target.current = +(0.18 + Math.random() * 1.45).toFixed(3);
      setWeight((w) => {
        const nw = w + (target.current - w) * 0.45 + (Math.random() - 0.5) * 0.006;
        return nw < 0 ? 0 : +nw.toFixed(3);
      });
    }, 500);
    return () => clearInterval(id);
  }, [connected, simulate, supported]);

  const disconnect = useCallback(async () => {
    keepReading.current = false;
    const port = portRef.current;
    portRef.current = null;
    setConnected(false);
    if (port) { try { await port.close(); } catch { /* noop */ } }
  }, []);

  const connect = useCallback(async () => {
    if (!supported) { setStatus("Este navegador no soporta Web Serial (usá Chrome/Edge)."); return; }
    try {
      const serial = (navigator as unknown as { serial: SerialLike }).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      keepReading.current = true;
      setConnected(true);
      setStatus("Balanza conectada");

      const readLoop = async () => {
        let buf = "";
        while (keepReading.current && port.readable) {
          const reader = port.readable.getReader();
          try {
            const decoder = new TextDecoder();
            while (keepReading.current) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const parts = buf.split(/[\r\n]+/);
              buf = parts.pop() ?? "";
              for (const line of parts) {
                const w = parseWeight(line);
                if (w !== null) setWeight(w);
              }
              if (buf.length > 512) buf = buf.slice(-256); // evita crecer sin límite
            }
          } catch {
            break; // desconexión / error de lectura
          } finally {
            try { reader.releaseLock(); } catch { /* noop */ }
          }
        }
      };
      readLoop().finally(() => { if (keepReading.current) disconnect(); });
    } catch (e) {
      setStatus(e instanceof Error && e.name === "NotFoundError" ? "No se eligió ninguna balanza." : "No se pudo conectar la balanza.");
      setConnected(false);
    }
  }, [supported, baudRate, disconnect]);

  useEffect(() => () => { keepReading.current = false; const p = portRef.current; if (p) { p.close().catch(() => {}); } }, []);

  return { weight, connected, supported, status, connect, disconnect };
}
