import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ClientesClient, { type Cliente } from "./ClientesClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: parties } = await supabase
    .from("parties")
    .select("id, name, tax_id, kind, classification, tax_condition, contact_name, phone, email, address, city, credit_limit, notes")
    .eq("org_id", ctx.orgId)
    .in("kind", ["cliente", "ambos"])
    .order("name");

  const ids = (parties ?? []).map((p) => p.id);
  const { data: docs } = ids.length
    ? await supabase
        .from("documents")
        .select("number, doc_date, due_date, total, balance_due, settlement, party_id")
        .eq("org_id", ctx.orgId)
        .eq("kind", "factura")
        .eq("status", "aprobado")
        .in("party_id", ids)
        .order("doc_date", { ascending: false })
    : { data: [] as Array<{ number: string | null; doc_date: string; due_date: string | null; total: number; balance_due: number; settlement: string; party_id: string }> };

  const today = new Date().toISOString().slice(0, 10);

  const clientes: Cliente[] = (parties ?? []).map((p) => {
    const myDocs = (docs ?? []).filter((d) => d.party_id === p.id);
    const saldo = myDocs.reduce((s, d) => s + Number(d.balance_due), 0);
    const vencido = myDocs
      .filter((d) => d.due_date && d.due_date < today && Number(d.balance_due) > 0)
      .reduce((s, d) => s + Number(d.balance_due), 0);
    const ult = myDocs.map((d) => d.doc_date).sort().at(-1) ?? null;
    return {
      id: p.id,
      name: p.name,
      taxId: p.tax_id ?? "",
      kind: (p.kind === "ambos" ? "ambos" : "cliente") as "cliente" | "ambos",
      classification: p.classification ?? "",
      taxCondition: p.tax_condition ?? "",
      contactName: p.contact_name ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      creditLimit: Number(p.credit_limit ?? 0),
      notes: p.notes ?? "",
      saldo,
      vencido,
      ult,
      docs: myDocs.slice(0, 6).map((d) => ({
        number: d.number ?? "",
        doc_date: d.doc_date,
        due_date: d.due_date,
        total: Number(d.total),
        balance_due: Number(d.balance_due),
        settlement: d.settlement,
      })),
    };
  });

  return <ClientesClient clientes={clientes} canEdit={ctx.role !== "cajero"} />;
}
