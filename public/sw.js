// Comercia · Service Worker · SOLO cachea assets estáticos (JS/CSS/fuentes/imágenes).
// NO intercepta navegaciones ni HTML/RSC: eso siempre va a la red, para no servir
// una página vieja contra un bundle nuevo (causa de errores de hidratación).
// El modo offline de la caja NO depende de esto: vive en la app (cola IndexedDB)
// mientras la pestaña esté abierta.

const CACHE = "comercia-static-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webmanifest)$/.test(url.pathname);
  if (!isStatic) return; // navegaciones / HTML / RSC → SIEMPRE de la red

  event.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }),
  );
});
