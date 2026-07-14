"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type MedioInput = {
  id?: string;
  name: string;
  type: "caja" | "bancaria" | "virtual" | "cartera";
  bank: string;
  balance: number;
  collect: boolean;
  qr?: string | null; // data URL del QR de cobro (billeteras: MODO, MP, Cuenta DNI…)
};

export async function upsertMedio(input: MedioInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.name.trim()) return { ok: false, error: "Falta el nombre" };
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  const supabase = await createClient();

  const fields = {
    name: input.name.trim(),
    type: input.type,
    bank: input.bank.trim() || null,
    balance: input.balance,
    collect: input.collect,
    qr: input.qr ?? null,
  };

  const { error } = input.id
    ? await supabase.from("fin_accounts").update(fields).eq("id", input.id)
    : await supabase.from("fin_accounts").insert({ org_id: ctx.orgId, ...fields });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tesoreria");
  return { ok: true };
}

export async function deleteMedio(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("fin_accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tesoreria");
  return { ok: true };
}
