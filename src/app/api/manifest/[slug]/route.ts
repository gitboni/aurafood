import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Manifest PWA dinámico por restaurante.
// Cada tenant instala su propia "app" con su nombre y logo, en vez
// del genérico "AuraFood".
//
// Se enlaza desde /r/[slug]/layout.tsx vía metadata.manifest.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let name = "AuraFood";
  let logo: string | null = null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: tenant } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (tenant) {
      name = tenant.name;
      const { data: settings } = await supabase
        .from("settings")
        .select("logo_url")
        .eq("restaurant_id", tenant.id)
        .maybeSingle();
      logo = settings?.logo_url ?? null;
    }
  } catch {
    // fallback al genérico
  }

  // Si el tenant tiene logo propio lo usamos; si no, los íconos base.
  const icons = logo
    ? [
        { src: logo, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [
        { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
        { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
      ];

  const manifest = {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: `${name} — Menú digital y pedidos`,
    start_url: `/r/${slug}/menu`,
    scope: `/r/${slug}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#cf5f37",
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Cache 1h en CDN; el nombre/logo no cambia seguido
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
