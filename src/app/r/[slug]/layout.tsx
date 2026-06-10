import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
    }
  } catch {
    // Cualquier error de red/conexión inesperado: dejamos pasar y que
    // el child decida — evitamos 500s en preview/dev sin DB.
  }

  return <>{children}</>;
}
