import { redirect } from "next/navigation";

// Ventas y Caja se unificaron: la ventana única es /caja (POS + caja del día).
// El componente VentasPOS/PosBoard sigue existiendo y lo usa /caja.
export default function VentasPage() {
  redirect("/caja");
}
