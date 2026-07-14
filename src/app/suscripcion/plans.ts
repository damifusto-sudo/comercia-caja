export type Plan = { label: string; amount: number; features: string[] };

export const PLANS: Record<string, Plan> = {
  basico: {
    label: "Básico",
    amount: 6000,
    features: ["1 sucursal (hasta 2 cajas)", "Todos los módulos del sistema", "Usuarios ilimitados", "Datos aislados y seguros"],
  },
  pro: {
    label: "Pro",
    amount: 10000,
    features: ["Sucursales ilimitadas", "Cajas ilimitadas", "Todos los módulos del sistema", "Soporte prioritario"],
  },
};

export const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
