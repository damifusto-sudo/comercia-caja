"use server";

import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PriceTier = "premium" | "normal" | "oferta";

export type ProductInput = {
  id?: string;
  name: string;
  category: string; // nombre; se busca o se crea
  sku: string;
  baseUnit: "u" | "kg" | "l";
  isWeighed: boolean;
  cost: number;
  salePrice: number;
  minStock: number;
  emoji: string;
  barcode: string;
  active: boolean;
  priceTier: PriceTier | null; // etiqueta de marcación (premium 40 / normal 30 / oferta 20)
  priceManual: boolean;        // true = precio fijado a mano (no lo recalcula la compra)
};

async function findOrCreateCategory(supabase: SupabaseClient, orgId: string, name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const { data: ex } = await supabase.from("categories").select("id").eq("org_id", orgId).ilike("name", n).maybeSingle();
  if (ex) return ex.id as string;
  const { data: created } = await supabase.from("categories").insert({ org_id: orgId, name: n }).select("id").single();
  return (created?.id as string) ?? null;
}

/**
 * Alta/edición de productos (ABM). El catálogo es único: lo que se crea acá
 * aparece automáticamente en Stock y en la Caja/POS. Escribe con la sesión del
 * usuario → la RLS exige rol manager+ (el cajero no llega acá por el guard).
 */
export async function saveProduct(input: ProductInput): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  if (!input.name.trim()) return { ok: false, error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const categoryId = await findOrCreateCategory(supabase, ctx.orgId, input.category);
  const row = {
    org_id: ctx.orgId,
    name: input.name.trim(),
    category_id: categoryId,
    sku: input.sku.trim() || null,
    base_unit: input.isWeighed ? "kg" : input.baseUnit, // pesable siempre en kg
    is_weighed: input.isWeighed,
    cost: input.cost > 0 ? input.cost : 0,
    sale_price: input.salePrice > 0 ? input.salePrice : 0,
    min_stock: input.minStock > 0 ? input.minStock : 0,
    emoji: input.emoji.trim() || null,
    barcode: input.barcode.trim() || null,
    active: input.active,
    price_tier: input.priceTier,
    price_manual: input.priceManual,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.id
    ? await supabase.from("products").update(row).eq("id", input.id).eq("org_id", ctx.orgId)
    : await supabase.from("products").insert(row);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/caja");
  revalidatePath("/ventas");
  return { ok: true };
}

export async function toggleProductActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.orgId) return { ok: false, error: "Sin sesión" };
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/caja");
  revalidatePath("/ventas");
  return { ok: true };
}
