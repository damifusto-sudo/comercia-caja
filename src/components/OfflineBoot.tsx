"use client";

import { useEffect } from "react";

/**
 * En PRODUCCIÓN registra el service worker (cachea sólo assets estáticos).
 * En DESARROLLO lo desregistra y limpia las cachés: evita que un SW previo sirva
 * HTML viejo y provoque errores de hidratación mientras se itera.
 */
export default function OfflineBoot() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* SW opcional */ });
    } else {
      navigator.serviceWorker.getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof window !== "undefined" && "caches" in window) {
        caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, []);
  return null;
}
