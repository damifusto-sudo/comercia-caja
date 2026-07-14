import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache de navegación del cliente: al volver a una pantalla visitada hace poco,
  // se sirve al instante desde el Router Cache (sin re-pedirla al servidor). Las
  // mutaciones llaman revalidatePath, así que los datos recién cambiados sí se
  // refrescan. Hace que "pasar de ventana a ventana" se sienta inmediato.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
