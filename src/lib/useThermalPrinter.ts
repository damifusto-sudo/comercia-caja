"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Impresora térmica ESC/POS vía WebUSB (Chrome/Edge, HTTPS o localhost). Sirve
 * para la mayoría de las térmicas USB de 58/80 mm (Epson TM, Xprinter, genéricas
 * clase impresora). connect() pide el dispositivo una vez; el navegador recuerda
 * el permiso, así que reconecta solo en visitas siguientes (autoReconnect).
 */

type UsbEndpoint = { endpointNumber: number; direction: "in" | "out"; type: string };
type UsbAlt = { endpoints: UsbEndpoint[] };
type UsbIface = { interfaceNumber: number; alternate: UsbAlt };
type UsbConfig = { interfaces: UsbIface[] };
type UsbDeviceLike = {
  opened: boolean;
  configuration: UsbConfig | null;
  productName?: string;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  transferOut: (endpoint: number, data: BufferSource) => Promise<{ status: string }>;
};
type UsbLike = {
  requestDevice: (o: { filters: { classCode?: number }[] }) => Promise<UsbDeviceLike>;
  getDevices: () => Promise<UsbDeviceLike[]>;
};

function getUsb(): UsbLike | null {
  if (typeof navigator === "undefined") return null;
  const u = (navigator as unknown as { usb?: UsbLike }).usb;
  return u ?? null;
}

// Encuentra la interfaz + endpoint OUT bulk de la impresora.
function findOut(dev: UsbDeviceLike): { iface: number; ep: number } | null {
  const cfg = dev.configuration;
  if (!cfg) return null;
  for (const it of cfg.interfaces) {
    const out = it.alternate.endpoints.find((e) => e.direction === "out");
    if (out) return { iface: it.interfaceNumber, ep: out.endpointNumber };
  }
  return null;
}

export function useThermalPrinter() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Sin impresora");
  const supported = typeof navigator !== "undefined" && "usb" in navigator;
  const devRef = useRef<UsbDeviceLike | null>(null);
  const epRef = useRef<{ iface: number; ep: number } | null>(null);

  const bind = useCallback(async (dev: UsbDeviceLike) => {
    if (!dev.opened) await dev.open();
    if (!dev.configuration) await dev.selectConfiguration(1);
    const target = findOut(dev);
    if (!target) throw new Error("La impresora no expone un endpoint de salida");
    await dev.claimInterface(target.iface);
    devRef.current = dev;
    epRef.current = target;
    setConnected(true);
    setStatus(`Impresora lista${dev.productName ? " · " + dev.productName : ""}`);
  }, []);

  // Reconexión automática si el navegador ya tiene permiso de un dispositivo
  useEffect(() => {
    const usb = getUsb();
    if (!usb) return;
    usb.getDevices().then((ds) => { if (ds[0]) bind(ds[0]).catch(() => {}); }).catch(() => {});
  }, [bind]);

  const connect = useCallback(async () => {
    const usb = getUsb();
    if (!usb) { setStatus("Este navegador no soporta WebUSB (usá Chrome/Edge)."); return; }
    try {
      const dev = await usb.requestDevice({ filters: [{ classCode: 7 }] }); // clase 7 = impresora
      await bind(dev);
    } catch (e) {
      setStatus(e instanceof Error && e.name === "NotFoundError" ? "No se eligió ninguna impresora." : "No se pudo conectar la impresora.");
      setConnected(false);
    }
  }, [bind]);

  const disconnect = useCallback(async () => {
    const dev = devRef.current;
    devRef.current = null; epRef.current = null; setConnected(false); setStatus("Sin impresora");
    if (dev) { try { await dev.close(); } catch { /* noop */ } }
  }, []);

  const print = useCallback(async (bytes: Uint8Array): Promise<{ ok: boolean; error?: string }> => {
    const dev = devRef.current, ep = epRef.current;
    if (!dev || !ep) return { ok: false, error: "No hay impresora conectada" };
    try {
      // Enviar en bloques por si el buffer de la impresora es chico
      const CHUNK = 4096;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        await dev.transferOut(ep.ep, bytes.slice(i, i + CHUNK));
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Error al imprimir" };
    }
  }, []);

  return { connected, supported, status, connect, disconnect, print };
}
