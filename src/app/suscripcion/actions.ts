"use server";

import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "./plans";

/** Crea una suscripción (preapproval) en Mercado Pago y devuelve la URL de pago.
 *  Requiere MP_ACCESS_TOKEN y NEXT_PUBLIC_APP_URL en el entorno del servidor. */
export async function crearSuscripcionMP(plan: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const ctx = await requireContext();
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: "Sólo el titular puede gestionar la suscripción." };
  if (!ctx.orgId) return { ok: false, error: "No hay comercio asociado a tu cuenta." };
  const p = PLANS[plan];
  if (!p) return { ok: false, error: "Plan inválido." };

  const token = process.env.MP_ACCESS_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !appUrl) return { ok: false, error: "Falta configurar Mercado Pago (MP_ACCESS_TOKEN y NEXT_PUBLIC_APP_URL)." };

  let res: Response;
  try {
    res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: `Comercia · Plan ${p.label}`,
        external_reference: ctx.orgId,
        payer_email: ctx.email,
        back_url: `${appUrl}/suscripcion?ok=1`,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: p.amount, currency_id: "ARS" },
        status: "pending",
      }),
    });
  } catch {
    return { ok: false, error: "No se pudo contactar a Mercado Pago." };
  }
  if (!res.ok) return { ok: false, error: "Mercado Pago rechazó la solicitud (" + res.status + ")." };

  const data = (await res.json()) as { id?: string; init_point?: string };
  if (!data.init_point) return { ok: false, error: "Mercado Pago no devolvió un enlace de pago." };

  // Registra el plan elegido + preapproval vía RPC (los tenants NO pueden escribir
  // subscriptions.status directo — el status sólo lo pone el webhook/service-role).
  const supabase = await createClient();
  await supabase.rpc("set_pending_plan", { p_plan: plan, p_preapproval: data.id ?? null });

  return { ok: true, url: data.init_point };
}
