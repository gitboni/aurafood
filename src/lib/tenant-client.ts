"use client";

// Hooks de cliente para tenant context.
// Server-side (cookies, supabase server) vive en ./tenant.ts.
//
// Resolución del tenant_id en cliente — en orden de prioridad:
//   1. Cookie `tenant_id` (la setea el middleware al pasar por /r/[slug]/...)
//   2. Slug del path (/r/[slug]/...) → resolver vía Supabase
//   3. Default: 'el-buen-comer' (compat con URLs viejas /pos, /menu)

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TENANT_SLUG_COOKIE = "tenant_slug";
const TENANT_ID_COOKIE = "tenant_id";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^| )" + name + "=([^;]+)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function slugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(
    /^\/r\/([a-z0-9][a-z0-9-]*[a-z0-9])(?:\/|$)/
  );
  return m ? m[1] : null;
}

const DEFAULT_SLUG = "el-buen-comer";

export type TenantContext = {
  tenantId: string | null;
  slug: string;
  resolving: boolean;
  error: string | null;
};

/**
 * Hook que resuelve el tenant activo en el cliente.
 * Devuelve { tenantId, slug, resolving, error }.
 *
 * Estrategia:
 *   1. Si la cookie tenant_id existe → uso directo (sincrono).
 *   2. Si no, busco el slug del path o uso default.
 *   3. Resuelvo slug → id con una query a restaurants.
 *
 * Cache: el resultado vive en window-level para no re-resolver
 * en cada componente que llame al hook.
 */
let cachedContext: { id: string; slug: string } | null = null;

export function useTenantId(): TenantContext {
  const [state, setState] = useState<TenantContext>(() => {
    // Lectura sincrona inicial: si las cookies ya están, listas
    const cookieId = readCookie(TENANT_ID_COOKIE);
    const cookieSlug = readCookie(TENANT_SLUG_COOKIE);
    if (cookieId && cookieSlug) {
      cachedContext = { id: cookieId, slug: cookieSlug };
      return {
        tenantId: cookieId,
        slug: cookieSlug,
        resolving: false,
        error: null,
      };
    }
    if (cachedContext) {
      return {
        tenantId: cachedContext.id,
        slug: cachedContext.slug,
        resolving: false,
        error: null,
      };
    }
    const guessSlug = slugFromPath() ?? DEFAULT_SLUG;
    return { tenantId: null, slug: guessSlug, resolving: true, error: null };
  });

  useEffect(() => {
    // Si ya tengo tenantId del cookie, no hago nada
    if (state.tenantId) return;
    let cancelled = false;
    const slug = state.slug;

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, slug")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState({
          tenantId: null,
          slug,
          resolving: false,
          error: error?.message ?? `Restaurante "${slug}" no encontrado`,
        });
        return;
      }

      cachedContext = { id: data.id, slug: data.slug };
      setState({
        tenantId: data.id,
        slug: data.slug,
        resolving: false,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
