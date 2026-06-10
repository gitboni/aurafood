"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const RESERVED = new Set([
  "super-admin", "admin", "api", "login", "signup", "menu", "pos",
  "kitchen", "floor", "display", "r", "www", "app",
]);

/**
 * Registro público de un restaurante (self-service SaaS).
 * Crea, en una sola operación server-side con service role:
 *   1. El restaurante (plan trial, 14 días)
 *   2. El usuario dueño (email confirmado, rol admin)
 *   3. Su profile atado al restaurant_id
 *   4. El row de settings del tenant
 *
 * Devuelve el slug en éxito para que el cliente haga signIn y
 * redirija al admin del nuevo restaurante.
 *
 * Nota: endpoint público — en producción conviene añadir rate-limit
 * o captcha para evitar abuso. Por ahora valida slug y email.
 */
export async function signupRestaurant(input: {
  restaurantName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const restaurantName = input.restaurantName.trim();
  const slug = input.slug.trim().toLowerCase();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  // ── Validaciones ──
  if (!restaurantName) return { ok: false, error: "Falta el nombre del restaurante" };
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 40) {
    return { ok: false, error: "Slug inválido (3-40, minúsculas, números y guiones)" };
  }
  if (RESERVED.has(slug)) return { ok: false, error: "Ese slug está reservado, elige otro" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Email inválido" };
  if (!password || password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Servidor no configurado" };
  }

  // Slug disponible?
  const { data: existing } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ese slug ya está en uso, elige otro" };

  // 1. Crear restaurante (trial 14 días)
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: tenant, error: tErr } = await admin
    .from("restaurants")
    .insert({
      slug,
      name: restaurantName,
      plan: "trial",
      status: "active",
      trial_ends_at: trialEnds,
    })
    .select("id, slug")
    .single();
  if (tErr || !tenant) {
    return { ok: false, error: tErr?.message ?? "No se pudo crear el restaurante" };
  }

  // 2. Crear usuario dueño
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: ownerName || email },
  });
  if (uErr || !created.user) {
    // Rollback del restaurante para no dejar basura
    await admin.from("restaurants").delete().eq("id", tenant.id);
    return { ok: false, error: uErr?.message ?? "No se pudo crear el usuario" };
  }

  // 3. Profile admin del tenant
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      role: "admin",
      display_name: ownerName || email,
      restaurant_id: tenant.id,
    },
    { onConflict: "id" }
  );
  if (pErr) {
    return { ok: false, error: `Cuenta creada pero falló el perfil: ${pErr.message}` };
  }

  // 4. Settings del tenant (para que menú/POS/admin no revienten)
  await admin.from("settings").insert({
    restaurant_id: tenant.id,
    restaurant_name: restaurantName,
  });

  return { ok: true, slug: tenant.slug };
}
