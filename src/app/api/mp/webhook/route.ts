import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/** Verifica la firma HMAC (x-signature) de Mercado Pago. Devuelve true si es
 *  válida, o si no hay secreto configurado (modo dev). El manifest es
 *  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmado con MP_WEBHOOK_SECRET. */
function verifyMpSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado: no se puede verificar (dev)
  const sig = req.headers.get("x-signature") ?? "";
  const reqId = req.headers.get("x-request-id") ?? "";
  const parts: Record<string, string> = {};
  for (const p of sig.split(",")) { const [k, v] = p.split("=").map((s) => s.trim()); if (k && v) parts[k] = v; }
  const ts = parts.ts, v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(expected, "hex"), b = Buffer.from(v1, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

/** Webhook de Mercado Pago: recibe notificaciones de la suscripción (preapproval),
 *  consulta el estado real en MP y actualiza subscriptions con la service-role key
 *  (bypassa RLS). Config requerida: MP_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL,
 *  SUPABASE_SERVICE_ROLE_KEY. */
export async function POST(req: NextRequest) {
  const token = process.env.MP_ACCESS_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !svcKey) return NextResponse.json({ ok: false, error: "no-config" }, { status: 200 });

  let body: { type?: string; action?: string; data?: { id?: string }; id?: string } = {};
  try { body = await req.json(); } catch { /* algunos hooks vienen por querystring */ }

  const type = body.type || body.action || req.nextUrl.searchParams.get("type") || "";
  const id = body.data?.id || body.id || req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("id");
  if (!/preapproval/i.test(type) || !id) return NextResponse.json({ ok: true });

  // Verifica la firma ANTES de cualquier llamada saliente (evita DoS/enumeración)
  if (!verifyMpSignature(req, String(id))) return NextResponse.json({ ok: false, error: "bad-signature" }, { status: 401 });

  // Estado real del preapproval en MP
  let pre: { external_reference?: string; status?: string; next_payment_date?: string };
  try {
    const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return NextResponse.json({ ok: true });
    pre = (await r.json()) as typeof pre;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const orgId = pre.external_reference;
  if (!orgId) return NextResponse.json({ ok: true });

  const status =
    pre.status === "authorized" ? "active" :
    pre.status === "cancelled" ? "canceled" :
    pre.status === "paused" ? "past_due" : "trial";

  const admin = createClient(url, svcKey, { auth: { persistSession: false } });
  await admin
    .from("subscriptions")
    .update({ status, mp_preapproval_id: String(id), current_period_end: pre.next_payment_date ?? null, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "mp-webhook" });
}
