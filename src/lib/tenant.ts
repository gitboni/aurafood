// ============================================================
// Tenant context (SaaS multi-tenant)
//
// Cómo viaja el tenant a lo largo del request:
//   1. URL /r/[slug]/...   → middleware extrae slug
//   2. Middleware valida   → restaurants WHERE slug = X
//   3. Middleware setea    → cookies "tenant_slug" + "tenant_id"
//   4. Server components   → leen cookies con getCurrentTenant()
//   5. Cliente Supabase    → headers que RLS usará (próximo commit)
//
// Mientras F3 no esté completo, las páginas viejas (/menu, /pos,
// etc.) NO leen tenant — siguen funcionando como mono-tenant
// igual que ahora (RLS por defecto cae al profile del usuario).
// ============================================================

import { cookies } from "next/headers";

export const TENANT_SLUG_COOKIE = "tenant_slug";
export const TENANT_ID_COOKIE = "tenant_id";

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
  plan: "trial" | "free" | "pro" | "enterprise";
  status: "active" | "past_due" | "suspended" | "cancelled";
  trial_ends_at: string | null;
  created_at: string;
};

export type CurrentTenant = {
  slug: string;
  id: string;
};

/**
 * Server-side: lee el tenant actual desde cookies (las setea el middleware).
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
 * Devuelve true si una ruta vive dentro del namespace de tenant /r/[slug]/...
 */
export function isTenantPath(pathname: string): boolean {
  return pathname.startsWith("/r/");
}

/**
 * Extrae el slug de una ruta /r/[slug]/... — devuelve null si no aplica.
 */
export function extractSlug(pathname: string): string | null {
  const match = pathname.match(/^\/r\/([a-z0-9][a-z0-9-]*[a-z0-9])(?:\/|$)/);
  return match ? match[1] : null;
}
