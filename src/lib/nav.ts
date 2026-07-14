export type NavItem = {
  href: string;
  label: string;
  icon: string;
  accent: string;
  ready?: boolean;
  badge?: string;
};

export type NavGroup = { group: string; items: NavItem[] };

// App MOSTRADOR ("solo caja"): únicamente las pantallas de venta de mostrador.
// El resto del sistema (compras, balances, tesorería, etc.) NO se expone acá.
export const NAV: NavGroup[] = [
  {
    group: "Mostrador",
    items: [
      { href: "/caja", label: "Ventas / Caja", icon: "cash", accent: "#00e6ff", ready: true },
      { href: "/productos", label: "Productos y stock", icon: "box", accent: "#4be0a8", ready: true },
      { href: "/offline", label: "Ventas offline", icon: "receipt", accent: "#f5a524", ready: true },
      { href: "/usuarios", label: "Usuarios y cajas", icon: "shield", accent: "#ff2bd6", ready: true },
    ],
  },
];
