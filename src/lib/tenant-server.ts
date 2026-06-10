// ============================================================
// Tenant helpers — server-only.
// Usan `next/headers` y el cliente Supabase server-side, así
// que NO se pueden importar desde middleware (Edge) ni desde
// client components. Para eso está `tenant.ts`.
// ============================================================

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  TENANT_ID_COOKIE,
  TENANT_SLUG_COOKIE,
  type CurrentTenant,
} from "./tenant";

/**
 * Lee el tenant actual desde cookies (las setea el middleware).
 * Devuelve null si no estamos en un contexto con tenant.
 */
export async function getCurrentTenant(): Promise<CurrentTenant | null> {
  const store = await cookies();
  const slug = store.get(TENANT_SLUG_COOKIE)?.value;
  const id = store.get(TENANT_ID_COOKIE)?.value;
  if (!slug || !id) return null;
  return { slug, id };
}

/**
 * Verifica si el usuario actual es super_admin.
 * Devuelve null si no hay sesión o el usuario no es super_admin.
 */
export async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, restaurant_id, display_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") return null;
  return { user, profile };
}
