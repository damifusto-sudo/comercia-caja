import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CajasClient, { type CajaRow } from "./CajasClient";

export const dynamic = "force-dynamic";

export default async function CajasPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase.rpc("cajas_today", { p_org: ctx.orgId });
  const r = (data ?? { cajas: [] }) as { ok?: boolean; cajas?: CajaRow[] };
  return <CajasClient cajas={r.cajas ?? []} />;
}
