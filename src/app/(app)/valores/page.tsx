import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ValoresClient, { type ChequeRow } from "./ValoresClient";

export const dynamic = "force-dynamic";

export default async function ValoresPage() {
  await requireContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("cheque_details")
    .select("id, number, bank, due_date, status, instruments(amount, type, payments(parties(name)))")
    .order("due_date");

  const cheques: ChequeRow[] = (data ?? [])
    .map((c) => {
      const inst = c.instruments as unknown as { amount: number; type: string; payments: { parties: { name: string } | null } | null } | null;
      return {
        id: c.id,
        number: c.number ?? "",
        bank: c.bank ?? "",
        dueDate: c.due_date,
        status: c.status as ChequeRow["status"],
        amount: Number(inst?.amount ?? 0),
        type: inst?.type ?? "",
        origin: inst?.payments?.parties?.name ?? "—",
      };
    })
    .filter((c) => c.type === "cheque_tercero");

  return <ValoresClient cheques={cheques} />;
}
