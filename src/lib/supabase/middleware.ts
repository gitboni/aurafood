import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define protected route prefixes
  const protectedPrefixes = ["/pos", "/kitchen", "/admin"];
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

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
      const pathname = request.nextUrl.pathname;

      const ROLE_ROUTES: Record<string, string[]> = {
        admin: ["/pos", "/kitchen", "/admin"],
        cashier: ["/pos", "/kitchen"],
        kitchen: ["/kitchen"],
      };

      const allowed = ROLE_ROUTES[role] ?? [];
      const hasAccess = allowed.some((prefix) => pathname.startsWith(prefix));

      if (!hasAccess) {
        const fallback = allowed[0] ?? "/";
        const url = request.nextUrl.clone();
        url.pathname = fallback;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
