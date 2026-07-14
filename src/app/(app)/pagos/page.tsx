import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PagosClient, { type Prov, type ChequePropio } from "./PagosClient";

export const dynamic = "force-dynamic";

export default async function PagosPage() {
  await requireContext();
  const supabase = await createClient();

  const { data: parties } = await supabase
    .from("parties")
    .select("id, name, tax_id, kind")
    .in("kind", ["proveedor", "ambos"])
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

  const { data: chq } = await supabase
    .from("cheque_details")
    .select("id, number, bank, issue_date, due_date, status, instruments!inner(amount, type, payments(parties(name)))")
    .eq("instruments.type", "cheque_propio")
    .order("due_date");

  const today = new Date().toISOString().slice(0, 10);

  const proveedores: Prov[] = (parties ?? []).map((p) => {
    const myDocs = (docs ?? []).filter((d) => d.party_id === p.id);
    const saldo = myDocs.reduce((s, d) => s + Number(d.balance_due), 0);
    const vencido = myDocs
      .filter((d) => d.due_date && d.due_date < today && Number(d.balance_due) > 0)
      .reduce((s, d) => s + Number(d.balance_due), 0);
    return {
      partyId: p.id,
      name: p.name,
      taxId: p.tax_id ?? "",
      saldo,
      vencido,
      docs: myDocs.map((d) => ({
        id: d.id, number: d.number ?? "", doc_date: d.doc_date, due_date: d.due_date,
        total: Number(d.total), balance_due: Number(d.balance_due), settlement: d.settlement,
        vencida: !!(d.due_date && d.due_date < today && Number(d.balance_due) > 0),
      })),
    };
  });

  const chequesPropios: ChequePropio[] = (chq ?? []).map((c) => {
    const inst = c.instruments as unknown as { amount: number; payments: { parties: { name: string } | null } | null } | null;
    return {
      id: c.id,
      number: c.number ?? "",
      bank: c.bank ?? "",
      issueDate: c.issue_date,
      dueDate: c.due_date,
      status: c.status,
      amount: Number(inst?.amount ?? 0),
      beneficiario: inst?.payments?.parties?.name ?? "—",
      vencido: !!(c.due_date && c.due_date < today),
    };
  });

  return <PagosClient proveedores={proveedores} chequesPropios={chequesPropios} />;
}
