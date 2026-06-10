"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Role = "admin" | "cashier" | "kitchen";

/**
 * Crea un usuario de staff (admin/cashier/kitchen) PARA EL TENANT
 * del admin que llama. Usa service role → NO reemplaza la sesión
 * del admin actual (el bug del signUp del cliente).
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el entorno.
 *
 * Seguridad: el caller debe ser admin (o super_admin) y el nuevo
 * usuario se ata al restaurant_id del caller — no puede crear
 * usuarios en otros tenants.
 */
export async function createStaffUser(
  email: string,
  password: string,
  displayName: string,
  role: Role
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, restaurant_id")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "admin" && caller?.role !== "super_admin") {
    return { ok: false, error: "Solo un administrador puede crear usuarios" };
  }
  const tenantId = caller.restaurant_id;
  if (!tenantId) {
    return { ok: false, error: "Tu cuenta no está asociada a un restaurante" };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return { ok: false, error: "Email inválido" };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
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

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName.trim() || cleanEmail },
  });
  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? "No se pudo crear el usuario" };
  }

  const { error: profErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: created.user.id,
        role,
        display_name: displayName.trim() || cleanEmail,
        restaurant_id: tenantId,
      },
      { onConflict: "id" }
    );
  if (profErr) {
    return { ok: false, error: `Usuario creado pero falló el perfil: ${profErr.message}` };
  }

  return { ok: true };
}
