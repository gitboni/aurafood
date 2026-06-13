"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "super_admin" ? user : null;
}

export type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  restaurant_slug: string | null;
  last_sign_in_at: string | null;
  created_at: string;
};

/**
 * Lista global de usuarios — solo super_admin. Usa service role para
 * cruzar profiles con auth.users (email + last_sign_in_at).
 */
export async function listAllUsers(): Promise<{ ok: true; users: UserRow[] } | { ok: false; error: string }> {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin" };

  let admin;
  try { admin = createAdminClient(); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Service role no configurado" }; }

  const supabase = await createClient();

  // Tenants para el nombre/slug por id
  const { data: tenants } = await supabase
    .from("restaurants").select("id, name, slug");
  const tenantById = new Map(
    (tenants ?? []).map((t) => [t.id, { name: t.name, slug: t.slug }])
  );

  // Profiles (super_admin bypasa RLS)
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, role, restaurant_id, created_at")
    .order("created_at", { ascending: false });
  if (pErr) return { ok: false, error: pErr.message };

  // Auth users — pagina hasta 1000 (suficiente para empezar)
  const { data: authData, error: aErr } = await admin.auth.admin.listUsers({
    page: 1, perPage: 1000,
  });
  if (aErr) return { ok: false, error: aErr.message };
  const authById = new Map(
    authData.users.map((u) => [
      u.id,
      { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null },
    ])
  );

  const users: UserRow[] = (profiles ?? []).map((p) => {
    const a = authById.get(p.id);
    const t = p.restaurant_id ? tenantById.get(p.restaurant_id) : null;
    return {
      id: p.id,
      email: a?.email ?? null,
      display_name: p.display_name,
      role: p.role,
      restaurant_id: p.restaurant_id,
      restaurant_name: t?.name ?? null,
      restaurant_slug: t?.slug ?? null,
      last_sign_in_at: a?.last_sign_in_at ?? null,
      created_at: p.created_at,
    };
  });

  return { ok: true, users };
}

/**
 * Resetea la contraseña de un usuario (super_admin only).
 * Devuelve la nueva contraseña para compartirla.
 */
export async function resetUserPassword(
  userId: string
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin" };
  let admin;
  try { admin = createAdminClient(); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Service role no configurado" }; }
  const newPwd =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6).toUpperCase() + "!";
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPwd });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/super-admin/users");
  return { ok: true, password: newPwd };
}

/**
 * Cambia el rol de un usuario. Solo entre admin/cashier/kitchen.
 * No permite tocar super_admin (proteger contra escalada accidental).
 */
export async function changeUserRole(
  userId: string,
  newRole: "admin" | "cashier" | "kitchen"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin" };
  if (!["admin", "cashier", "kitchen"].includes(newRole)) {
    return { ok: false, error: "Rol inválido" };
  }
  const supabase = await createClient();
  // No tocar a super_admins por seguridad
  const { data: cur } = await supabase
    .from("profiles").select("role").eq("id", userId).single();
  if (cur?.role === "super_admin") {
    return { ok: false, error: "No se puede cambiar el rol de un super_admin desde aquí" };
  }
  const { error } = await supabase
    .from("profiles").update({ role: newRole }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/super-admin/users");
  return { ok: true };
}
