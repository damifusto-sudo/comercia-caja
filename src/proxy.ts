import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

/** Next.js 16: el ex-`middleware` se llama ahora `proxy`. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Corre en todo, salvo estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
