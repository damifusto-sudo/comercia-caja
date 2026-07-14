import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MayorClient, { type Account, type Entry } from "./MayorClient";

export const dynamic = "force-dynamic";

export default async function MayorPage() {
  await requireContext();
  const supabase = await createClient();

  const { data: accs } = await supabase.from("gl_accounts").select("id, code, name, type").order("code");
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id, entry_date, event, journal_lines(gl_account_id, debit, credit)")
    .order("entry_date")
    .order("created_at");

  const accById = new Map((accs ?? []).map((a) => [a.id, a]));

  // Sumas y saldos
  const sums = new Map<string, { debe: number; haber: number }>();
  for (const e of entries ?? []) {
    for (const l of (e.journal_lines as { gl_account_id: string; debit: number; credit: number }[]) ?? []) {
      const cur = sums.get(l.gl_account_id) ?? { debe: 0, haber: 0 };
      cur.debe += Number(l.debit);
      cur.haber += Number(l.credit);
      sums.set(l.gl_account_id, cur);
    }
  }

  const accounts: Account[] = (accs ?? [])
    .map((a) => {
      const s = sums.get(a.id) ?? { debe: 0, haber: 0 };
      return { id: a.id, code: a.code, name: a.name, type: a.type, debe: s.debe, haber: s.haber };
    })
    .filter((a) => a.debe !== 0 || a.haber !== 0);

  const asientos: Entry[] = (entries ?? []).map((e) => ({
    id: e.id,
    date: e.entry_date,
    event: e.event ?? "",
    lines: ((e.journal_lines as { gl_account_id: string; debit: number; credit: number }[]) ?? [])
      .map((l) => {
        const a = accById.get(l.gl_account_id);
        return { code: a?.code ?? "?", name: a?.name ?? "?", debit: Number(l.debit), credit: Number(l.credit) };
      })
      .sort((x, y) => y.debit - x.debit),
  }));

  return <MayorClient accounts={accounts} entries={asientos} />;
}
