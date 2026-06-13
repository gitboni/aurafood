"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "super_admin" ? user : null;
}

export async function createAnnouncement(
  message: string,
  type: string,
  expiresAt: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin" };
  if (!message.trim()) return { ok: false, error: "Mensaje requerido" };
  if (!["info", "warning", "maintenance", "success"].includes(type)) {
    return { ok: false, error: "Tipo inválido" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    message: message.trim(),
    type,
    active: true,
    expires_at: expiresAt || null,
    created_by: caller.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/super-admin/announcements");
  return { ok: true };
}

export async function toggleAnnouncement(id: string, active: boolean) {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin" };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/super-admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(id: string) {
  const caller = await assertSuperAdmin();
  if (!caller) return { ok: false, error: "Solo super_admin" };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/super-admin/announcements");
  return { ok: true };
}
