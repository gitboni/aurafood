// ============================================================
// Tenant context (SaaS multi-tenant)
//
// Este archivo es PURO: solo tipos y utilidades sin runtime
// específico, para que se pueda importar desde middleware
// (Edge), server components Y client components sin arrastrar
// dependencias incompatibles.
//
// Helpers que necesitan `next/headers` o el cliente Supabase
// server-side viven en `tenant-server.ts`.
// ============================================================

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
