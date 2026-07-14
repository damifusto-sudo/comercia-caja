import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CuentasClient, { type Cliente } from "./CuentasClient";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  await requireContext();
  const supabase = await createClient();

  const { data: parties } = await supabase
    .from("parties")
    .select("id, name, tax_id, kind")
    .in("kind", ["cliente", "ambos"])
    .order("name");

  const ids = (parties ?? []).map((p) => p.id);
  const { data: docs } = ids.length
    ? await supabase
        .from("documents")
        .select("id, number, doc_date, due_date, total, balance_due, settlement, party_id")
        .eq("kind", "factura")
        .eq("status", "aprobado")
        .in("party_id", ids)
        .order("due_date")
    : { data: [] as never[] };

  const today = new Date().toISOString().slice(0, 10);

  const clientes: Cliente[] = (parties ?? []).map((p) => {
    const myDocs = (docs ?? []).filter((d) => d.party_id === p.id);
    const saldo = myDocs.reduce((s, d) => s + Number(d.balance_due), 0);
    const vencido = myDocs
      .filter((d) => d.due_date && d.due_date < today && Number(d.balance_due) > 0)
      .reduce((s, d) => s + Number(d.balance_due), 0);
    const ult = myDocs.map((d) => d.doc_date).sort().at(-1) ?? null;
    return {
      partyId: p.id,
      name: p.name,
      taxId: p.tax_id ?? "",
      saldo,
      vencido,
      ult,
      docs: myDocs.map((d) => ({
        id: d.id,
        number: d.number ?? "",
        doc_date: d.doc_date,
        due_date: d.due_date,
        total: Number(d.total),
        balance_due: Number(d.balance_due),
        settlement: d.settlement,
        vencida: !!(d.due_date && d.due_date < today && Number(d.balance_due) > 0),
      })),
    };
  });

  return <CuentasClient clientes={clientes} />;
}
