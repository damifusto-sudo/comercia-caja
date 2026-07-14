import { redirect } from "next/navigation";

// Stock y Productos se unificaron en /productos ("Productos y stock").
export default function StockPage() {
  redirect("/productos");
}
