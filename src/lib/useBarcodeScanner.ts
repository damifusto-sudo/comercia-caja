"use client";

import { useEffect, useRef } from "react";

/**
 * Lector de código de barras por HID (el 99% de los lectores USB de mano se
 * comportan como un teclado: "tipean" el código y mandan Enter). Detecta la
 * ráfaga rápida de teclas terminada en Enter y dispara onScan(code). Como el
 * tipeo humano tiene pausas mayores al umbral, no se confunde con escritura
 * manual en los campos. No requiere driver ni permisos.
 *
 * Fallback por cámara (BarcodeDetector) se puede sumar aparte para celulares.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  opts?: { minLength?: number; maxGapMs?: number; enabled?: boolean },
) {
  const min = opts?.minLength ?? 3;
  const maxGap = opts?.maxGapMs ?? 55;
  const enabled = opts?.enabled ?? true;
  const buf = useRef("");
  const last = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const now = Date.now();
      if (now - last.current > maxGap) buf.current = ""; // pausa larga → arranca de nuevo
      last.current = now;

      if (e.key === "Enter") {
        const code = buf.current;
        buf.current = "";
        if (code.length >= min) {
          e.preventDefault();
          cb.current(code);
        }
        return;
      }
      if (e.key.length === 1) buf.current += e.key; // ignora Shift, Tab, flechas, etc.
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [min, maxGap, enabled]);
}
