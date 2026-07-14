import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import OfflineBoot from "@/components/OfflineBoot";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Usuario autenticado pero sin comercio (signup a medias) → completar el alta.
  if (!ctx.isSuperadmin && !ctx.orgId) redirect("/onboarding");

  // Gate de suscripción (UI). El enforcement real está en RLS (las escrituras
  // exigen subscription_active). Acá sólo bloquea ante un "false" explícito
  // (fail-open ante error transitorio para no dejar afuera por un problema de red).
  if (!ctx.isSuperadmin && ctx.orgId) {
    const { data: active } = await supabase.rpc("subscription_active", { p_org: ctx.orgId });
    if (active === false) redirect("/suscripcion");
  }

  // App MOSTRADOR: producto "solo caja". TODOS los roles quedan acotados a las
  // pantallas de mostrador (Caja / POS / Productos / Ventas offline). Cualquier otra
  // ruta se redirige a la pantalla inicial según el rol. (El motor y la base son
  // compartidos con Comercia; acá simplemente NO se exponen los módulos admin.)
  const MOSTRADOR = (p: string) =>
    ["/caja", "/ventas", "/productos", "/offline"].some((r) => p === r || p.startsWith(r + "/"));
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (ctx.orgId && pathname && !MOSTRADOR(pathname) && pathname !== "/onboarding" && pathname !== "/suscripcion") {
    redirect(ctx.role === "cajero" ? "/caja" : "/ventas");
  }
  const badges: Record<string, string> = {};

  const initials =
    (ctx.fullName || ctx.email)
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const roleLabel =
    ctx.role === "cajero" ? "Cajero" : ctx.role === "manager" ? "Encargado" : "Administrador";

  return (
    <div className="cx-app">
      <OfflineBoot />
      <Sidebar
        role={ctx.role}
        badges={badges}
        isSuperadmin={ctx.isSuperadmin}
        user={{ name: ctx.fullName || ctx.email, role: roleLabel, initials }}
      />
      <div className="cx-main">{children}</div>
    </div>
  );
}
