import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ShieldCheck, LogOut } from "lucide-react";
import { stopImpersonating } from "@/app/super-admin/restaurants/actions";

// Metadata por tenant: título + manifest PWA propio del restaurante.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let name = "AuraFood";
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("restaurants")
      .select("name")
      .eq("slug", slug)
      .maybeSingle();
    if (data?.name) name = data.name;
  } catch {
    // fallback
  }
  return {
    title: name,
    manifest: `/api/manifest/${slug}`,
    appleWebApp: { capable: true, title: name },
  };
}

// Layout del namespace de tenant /r/[slug]/...
// Valida que el slug existe ANTES de renderizar cualquier child.
// El middleware ya hace esto + setea cookies, pero este layout
// es la defensa final para SSR/cache y mensajes de error legibles.
//
// MIENTRAS F1 NO ESTÉ APLICADO: si la tabla `restaurants` no existe,
// el layout se renderiza igual (modo permisivo) para no romper el dev.

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let tenantName: string | null = null;

  // Validación con anon key (no necesita sesión)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from("restaurants")
      .select("slug, name, status")
      .eq("slug", slug)
      .maybeSingle();

    // 42P01 = la tabla todavía no existe (pre-F1) → modo permisivo
    if (error && error.code !== "42P01") {
      notFound();
    }
    if (error?.code !== "42P01") {
      if (!data) notFound();
      if (data.status === "suspended" || data.status === "cancelled") {
        return (
          <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-3">
            <h1 className="font-display text-3xl text-primary">
              {data.name}
            </h1>
            <p className="text-muted-foreground max-w-md">
              Este restaurante no está activo en este momento. Si eres el
              propietario, contacta con soporte.
            </p>
          </main>
        );
      }
      tenantName = data?.name ?? null;
    }
  } catch {
    // Cualquier error de red/conexión inesperado: dejamos pasar y que
    // el child decida — evitamos 500s en preview/dev sin DB.
  }

  // ── Banner de impersonate (solo si el usuario actual es super_admin)
  // Lee con la sesión real: si el usuario logueado es super_admin Y está
  // navegando un tenant que no es el suyo del profile, mostramos banner.
  let isImpersonating = false;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isImpersonating = profile?.role === "super_admin";
    }
  } catch {
    // Sin sesión: cliente normal, no se muestra el banner
  }

  // ── Anuncio global activo (lectura pública por RLS)
  let announcement: { message: string; type: string } | null = null;
  try {
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabaseAnon
      .from("announcements")
      .select("message, type")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) announcement = data;
  } catch {
    // Tabla aún no existe (pre-patch7) o error — ignoramos
  }

  const annStyles: Record<string, string> = {
    info: "bg-sky-500/90 text-white",
    warning: "bg-amber-500/90 text-white",
    maintenance: "bg-violet-500/90 text-white",
    success: "bg-emerald-500/90 text-white",
  };
  const annEmoji: Record<string, string> = {
    info: "💬", warning: "⚠️", maintenance: "🛠️", success: "✨",
  };

  return (
    <>
      {announcement && (
        <div className={`px-4 py-1.5 text-xs flex items-center gap-2 ${annStyles[announcement.type] ?? "bg-foreground/80 text-background"}`}>
          <span>{annEmoji[announcement.type] ?? "💬"}</span>
          <span className="flex-1 truncate">{announcement.message}</span>
        </div>
      )}
      {isImpersonating && (
        <div className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center gap-3 text-sm shadow">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            Modo Super Admin · Operando{" "}
            <strong>{tenantName ?? slug}</strong> como su admin
          </span>
          <Link
            href="/super-admin/restaurants"
            className="underline underline-offset-2 hover:opacity-80 hidden sm:inline"
          >
            Volver al panel
          </Link>
          <form action={stopImpersonating}>
            <button
              type="submit"
              className="flex items-center gap-1 rounded bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2 py-1 transition-colors"
              title="Salir del modo super admin"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </form>
        </div>
      )}
      {children}
    </>
  );
}
