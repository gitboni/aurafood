import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_ID_COOKIE, TENANT_SLUG_COOKIE, extractSlug } from "@/lib/tenant";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Tenant resolution (SaaS) ───────────────────────────────
  // Si la URL es /r/[slug]/..., resolver el slug → restaurant_id
  // y guardar en cookies para que server/client lo lean.
  // Si la tabla `restaurants` aún no existe (pre-F1), saltar
  // silenciosamente — las rutas viejas /menu, /pos siguen
  // funcionando exactamente como antes.
  const pathname = request.nextUrl.pathname;
  const slugFromUrl = extractSlug(pathname);

  if (slugFromUrl) {
    const existingSlug = request.cookies.get(TENANT_SLUG_COOKIE)?.value;
    if (existingSlug !== slugFromUrl) {
      // Validar contra la BD
      const { data: tenant, error } = await supabase
        .from("restaurants")
        .select("id, slug, status")
        .eq("slug", slugFromUrl)
        .maybeSingle();

      // Tabla no existe (42P01) → estamos pre-F1, ignoramos
      // Cualquier otro error de resolución → 404
      if (error && error.code !== "42P01") {
        return new NextResponse("Restaurante no disponible", { status: 404 });
      }

      if (tenant) {
        if (tenant.status === "suspended" || tenant.status === "cancelled") {
          return new NextResponse("Este restaurante no está activo", {
            status: 403,
          });
        }
        // Persistir en cookies — duran toda la sesión del navegador
        const cookieOpts = {
          path: "/",
          httpOnly: false, // necesario para que cliente Supabase lo lea
          sameSite: "lax" as const,
          secure: process.env.NODE_ENV === "production",
        };
        supabaseResponse.cookies.set(TENANT_SLUG_COOKIE, tenant.slug, cookieOpts);
        supabaseResponse.cookies.set(TENANT_ID_COOKIE, tenant.id, cookieOpts);
      } else if (!error) {
        // Slug no existe en BD
        return new NextResponse("Restaurante no encontrado", { status: 404 });
      }
    }
  }

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define protected route prefixes (legacy + tenant-scoped)
  const protectedSuffixes = ["/pos", "/kitchen", "/admin"];
  const isProtected =
    protectedSuffixes.some((s) => pathname.startsWith(s)) ||
    (slugFromUrl !== null &&
      protectedSuffixes.some((s) => pathname.includes(s)));

  // Redirect unauthenticated users to login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Role-Based Access Control ──────────────────────────────
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (role) {
      // super_admin tiene acceso total
      if (role === "super_admin") {
        return supabaseResponse;
      }

      const ROLE_SUFFIXES: Record<string, string[]> = {
        admin: ["/pos", "/kitchen", "/admin"],
        cashier: ["/pos", "/kitchen"],
        kitchen: ["/kitchen"],
      };

      const allowed = ROLE_SUFFIXES[role] ?? [];
      const hasAccess = allowed.some(
        (suffix) =>
          pathname.startsWith(suffix) || pathname.includes(suffix)
      );

      if (!hasAccess) {
        const fallback = allowed[0] ?? "/";
        const url = request.nextUrl.clone();
        // Si estamos en /r/[slug]/..., mantener el namespace al redirigir
        url.pathname = slugFromUrl
          ? `/r/${slugFromUrl}${fallback}`
          : fallback;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
