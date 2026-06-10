"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID_COOKIE, TENANT_SLUG_COOKIE } from "@/lib/tenant";

// Verifica que el caller sea super_admin. Devuelve el user o null.
async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "super_admin" ? user : null;
}

/**
 * Invita (crea) un usuario admin para un tenant.
 * Usa service role: crea el usuario con email confirmado y una
 * contraseña temporal generada, le asigna profile role='admin' +
 * restaurant_id. Devuelve la contraseña temporal para compartirla
 * con el dueño del restaurante (no requiere SMTP configurado).
 */
export async function inviteTenantAdmin(
  restaurantId: string,
  email: string,
  displayName: string
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin puede invitar" };

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return { ok: false, error: "Email inválido" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Service role no configurado",
    };
  }

  // Verificar que el tenant existe
  const { data: tenant } = await admin
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Restaurante no encontrado" };

  // Contraseña temporal: 12 chars alfanum + símbolo
  const tempPassword =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "!";

  // Crear usuario con email ya confirmado
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName.trim() || cleanEmail },
  });

  if (createErr || !created.user) {
    return {
      ok: false,
      error: createErr?.message ?? "No se pudo crear el usuario",
    };
  }

  // Asignar profile: admin de ESTE tenant
  const { error: profErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: created.user.id,
        role: "admin",
        display_name: displayName.trim() || cleanEmail,
        restaurant_id: restaurantId,
      },
      { onConflict: "id" }
    );

  if (profErr) {
    return { ok: false, error: `Usuario creado pero falló el perfil: ${profErr.message}` };
  }

  return { ok: true, tempPassword };
}

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
