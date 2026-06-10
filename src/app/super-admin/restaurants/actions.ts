"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TENANT_ID_COOKIE, TENANT_SLUG_COOKIE } from "@/lib/tenant";

/**
 * Impersonate un tenant como super_admin.
 * Setea las cookies de tenant y redirige al admin del restaurante.
 * El usuario sigue siendo super_admin (RLS lo deja pasar por bypass),
 * pero la UI ahora se comporta como si fuera el admin de ese tenant.
 */
export async function impersonateTenant(restaurantId: string, slug: string) {
  // Verificar permisos: solo super_admin puede impersonar
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return { error: "Solo super_admin puede impersonar" };
  }

  // Verificar que el tenant existe
  const { data: tenant, error } = await supabase
    .from("restaurants")
    .select("id, slug, status")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !tenant) {
    return { error: "Restaurante no encontrado" };
  }
  if (tenant.slug !== slug) {
    return { error: "Slug no coincide" };
  }

  // Setear cookies de tenant
  const store = await cookies();
  const opts = {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  store.set(TENANT_SLUG_COOKIE, tenant.slug, opts);
  store.set(TENANT_ID_COOKIE, tenant.id, opts);

  // Redirigir al admin del tenant
  redirect(`/r/${tenant.slug}/admin/menu`);
}

/**
 * Salir de impersonate: borra las cookies de tenant.
 * Vuelve al super-admin.
 */
export async function stopImpersonating() {
  const store = await cookies();
  store.delete(TENANT_SLUG_COOKIE);
  store.delete(TENANT_ID_COOKIE);
  redirect("/super-admin");
}
