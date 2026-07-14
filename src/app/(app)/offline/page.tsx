import { requireContext } from "@/lib/auth";
import OfflineClient from "./OfflineClient";

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  await requireContext();
  // Las ventas offline viven en el dispositivo (IndexedDB); la pantalla es cliente.
  return <OfflineClient />;
}
