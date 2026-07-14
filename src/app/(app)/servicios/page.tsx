import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ServiciosClient, { type ServiceRow } from "./ServiciosClient";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  await requireContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select("id, number, concept, doc_date, due_date, total, balance_due, settlement, category, party_id, parties(name, tax_id)")
    .eq("kind", "factura")
    .like("category", "servicio:%")
    .order("due_date");

  const today = new Date().toISOString().slice(0, 10);

  const rows: ServiceRow[] = (data ?? []).map((d) => {
    const p = d.parties as unknown as { name: string; tax_id: string | null } | null;
    return {
      id: d.id,
      partyId: d.party_id,
      subaccount: (d.category ?? "servicio:otros").split(":")[1] ?? "otros",
      provider: p?.name ?? "—",
      taxId: p?.tax_id ?? "",
      concept: d.concept ?? "",
      docDate: d.doc_date,
      dueDate: d.due_date,
      total: Number(d.total),
      balance: Number(d.balance_due),
      settlement: d.settlement,
      vencida: !!(d.due_date && d.due_date < today && Number(d.balance_due) > 0),
    };
  });

  return <ServiciosClient rows={rows} />;
}
