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
      { href: "/ventas", label: "Ventas / POS", icon: "cart", accent: "#2fe6c8", ready: true },
      { href: "/caja", label: "Caja diaria", icon: "cash", accent: "#39d98a", ready: true },
      { href: "/productos", label: "Productos y stock", icon: "box", accent: "#4be0a8", ready: true },
      { href: "/offline", label: "Ventas offline", icon: "receipt", accent: "#f5a524", ready: true },
    ],
  },
];
