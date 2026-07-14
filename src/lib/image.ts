"use client";

/**
 * Lee una imagen (p. ej. la captura del QR de la billetera) y la reduce a un
 * data URL PNG de lado máximo `max` px, para guardarla liviana en la base
 * (fin_accounts.qr). Devuelve null si el archivo no es una imagen válida.
 */
export async function imageToDataUrl(file: File, max = 480): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("imagen inválida"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // fondo blanco (los QR se leen mejor)
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}
