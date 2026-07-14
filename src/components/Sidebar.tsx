"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";
import Icon from "./Icon";

export default function Sidebar({
  role,
  user,
  badges = {},
  isSuperadmin = false,
}: {
  role: "owner" | "admin" | "manager" | "cajero";
  user: { name: string; role: string; initials: string };
  badges?: Record<string, string>;
  isSuperadmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // El cajero opera TODO desde su caja (ventas integradas adentro): una sola
  // ventana, su caja individual + la cola offline. El resto de los roles ve el
  // menú completo (cajas/ventas/offline se acceden desde el Panel de control).
  const groups =
    role === "cajero"
      ? [{
          group: "Operación",
          items: [
            { href: "/caja", label: "Caja diaria", icon: "cash", accent: "#39d98a", ready: true },
            { href: "/offline", label: "Ventas offline", icon: "receipt", accent: "#f5a524", ready: true },
          ],
        }]
      : NAV;

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="cx-side">
      <div className="cx-brand">
        <div className="cx-mark">C</div>
        <div>
          <div className="cx-brand-name">Comercia Caja</div>
          <div className="cx-brand-sub">Punto de venta</div>
        </div>
      </div>

      <nav className="cx-nav">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="cx-group">{g.group}</div>
            {g.items.map((it) => {
              const active = pathname === it.href;
              const cls = "cx-navlink" + (active ? " active" : "") + (it.ready ? "" : " soon");
              const badge = badges[it.href] ?? it.badge;
              const inner = (
                <>
                  <Icon name={it.icon} size={17} />
                  <span>{it.label}</span>
                  {badge && <span className="cx-badge">{badge}</span>}
                  {!it.ready && <span className="cx-soon">pronto</span>}
                </>
              );
              return it.ready ? (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cls}
                  style={active ? ({ ["--acc" as string]: it.accent } as React.CSSProperties) : undefined}
                >
                  {inner}
                </Link>
              ) : (
                <span key={it.href} className={cls} aria-disabled="true">
                  {inner}
                </span>
              );
            })}
          </div>
        ))}
      </nav>

      {isSuperadmin && (
        <Link href="/admin" className={"cx-navlink" + (pathname === "/admin" ? " active" : "")} style={{ margin: "0 10px 8px" }}>
          <Icon name="shield" size={17} />
          <span>Admin proveedor</span>
        </Link>
      )}

      <div className="cx-who">
        <div className="cx-avatar">{user.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cx-who-name">{user.name}</div>
          <div className="cx-who-role">{user.role}</div>
        </div>
        <button className="cx-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
  );
}
