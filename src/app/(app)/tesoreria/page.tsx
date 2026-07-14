import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TesoreriaLive, { type Medio, type Caja } from "./TesoreriaLive";

export const dynamic = "force-dynamic";

export default async function TesoreriaPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: accs } = await supabase
    .from("fin_accounts")
    .select("id, name, type, bank, balance, collect, qr")
    .order("created_at");

  const { data: cajas } = await supabase
    .from("cash_registers")
    .select("id, name, username, active, branches(name)")
    .order("name");

  const medios: Medio[] = (accs ?? []).map((a) => ({
    id: a.id, name: a.name, type: a.type, bank: a.bank ?? "", balance: Number(a.balance), collect: a.collect,
    qr: (a as { qr?: string | null }).qr ?? null,
  }));

  const cajasV: Caja[] = (cajas ?? []).map((c) => {
    const br = c.branches as unknown as { name: string } | null;
    return { id: c.id, name: c.name, branch: br?.name ?? "—", username: c.username ?? "", active: c.active };
  });

  return <TesoreriaLive medios={medios} cajas={cajasV} orgName={ctx.orgName} operator={ctx.fullName || ctx.email} />;
}
