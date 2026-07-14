import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ExcepcionesLive, { type Exc, type OpenDoc } from "./ExcepcionesLive";

export const dynamic = "force-dynamic";

export default async function ExcepcionesPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  // 1) Pagos sin conciliar (recibidos, aún sin aplicar a factura)
  const { data: pendRaw } = await supabase
    .from("payments")
    .select("id, party_id, direction, amount, source, source_ref, pay_date, created_at, parties(name)")
    .eq("status", "pendiente")
    .order("amount", { ascending: false });

  // 2) Créditos a favor (sobrepagos / cobros a cuenta)
  const { data: credsRaw } = await supabase
    .from("credits")
    .select("id, party_id, amount, remaining, created_at, source_payment_id, parties(name)")
    .gt("remaining", 0.5)
    .order("remaining", { ascending: false });

  // Origen/dirección de cada crédito vía su pago de origen
  const srcIds = [...new Set((credsRaw ?? []).map((c: { source_payment_id: string | null }) => c.source_payment_id).filter(Boolean))] as string[];
  const { data: srcPays } = srcIds.length
    ? await supabase.from("payments").select("id, source, source_ref, direction").in("id", srcIds)
    : { data: [] as { id: string; source: string; source_ref: string | null; direction: "cobro" | "pago" }[] };
  const srcMap = new Map((srcPays ?? []).map((p) => [p.id, p]));

  // 3) Cheques de terceros rechazados (reversión)
  const { data: chqRaw } = await supabase
    .from("cheque_details")
    .select("id, number, bank, created_at, instruments(amount, payments(party_id, direction, source, source_ref, parties(name)))")
    .eq("status", "rechazado");

  const nm = (rel: unknown): string => {
    const p = Array.isArray(rel) ? rel[0] : rel;
    return (p as { name?: string } | null)?.name ?? "—";
  };
  const one = <T,>(rel: unknown): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : (rel as T | null));

  const items: Exc[] = [];

  for (const p of (pendRaw ?? []) as Array<Record<string, unknown>>) {
    items.push({
      id: p.id as string,
      kind: "pendiente",
      partyId: p.party_id as string,
      party: nm(p.parties),
      direction: (p.direction as "cobro" | "pago") ?? "cobro",
      amount: Number(p.amount),
      source: (p.source as string) ?? "manual",
      sourceRef: (p.source_ref as string) ?? null,
      date: (p.created_at as string) ?? (p.pay_date as string),
      detail: null,
    });
  }

  for (const c of (credsRaw ?? []) as Array<Record<string, unknown>>) {
    const sp = c.source_payment_id ? srcMap.get(c.source_payment_id as string) : undefined;
    items.push({
      id: c.id as string,
      kind: "credito",
      partyId: c.party_id as string,
      party: nm(c.parties),
      direction: sp?.direction ?? "cobro",
      amount: Number(c.remaining),
      source: sp?.source ?? "manual",
      sourceRef: sp?.source_ref ?? null,
      date: c.created_at as string,
      detail: null,
    });
  }

  for (const ch of (chqRaw ?? []) as Array<Record<string, unknown>>) {
    const inst = one<{ amount: number; payments: unknown }>(ch.instruments);
    const pay = one<{ party_id: string; direction: "cobro" | "pago"; source: string; source_ref: string | null; parties: unknown }>(inst?.payments);
    const det = [ch.number ? "Cheque " + ch.number : "", ch.bank as string].filter(Boolean).join(" · ");
    items.push({
      id: ch.id as string,
      kind: "cheque",
      partyId: pay?.party_id ?? "",
      party: nm(pay?.parties),
      direction: pay?.direction ?? "cobro",
      amount: Number(inst?.amount ?? 0),
      source: pay?.source ?? "manual",
      sourceRef: pay?.source_ref ?? null,
      date: ch.created_at as string,
      detail: det || null,
    });
  }

  items.sort((a, b) => b.amount - a.amount);

  // Facturas abiertas por entidad (para el modal de "Aplicar crédito")
  const credPartyIds = [...new Set((credsRaw ?? []).map((c: { party_id: string }) => c.party_id))];
  const { data: odocs } = credPartyIds.length
    ? await supabase
        .from("documents")
        .select("id, number, due_date, balance_due, party_id")
        .eq("kind", "factura")
        .eq("status", "aprobado")
        .gt("balance_due", 0.5)
        .in("party_id", credPartyIds)
        .order("due_date")
    : { data: [] as Array<{ id: string; number: string | null; due_date: string | null; balance_due: number; party_id: string }> };

  const openDocs: Record<string, OpenDoc[]> = {};
  for (const d of odocs ?? []) {
    (openDocs[d.party_id] ??= []).push({
      id: d.id,
      number: d.number ?? "",
      balance_due: Number(d.balance_due),
      due_date: d.due_date,
    });
  }

  return (
    <ExcepcionesLive
      items={items}
      openDocs={openDocs}
      orgName={ctx.orgName}
      operator={ctx.fullName || ctx.email}
      canEdit={ctx.role !== "cajero"}
    />
  );
}
