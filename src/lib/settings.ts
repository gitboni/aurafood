"use client";

import { createClient } from "@/lib/supabase/client";
import { Settings } from "@/lib/types";

const DEFAULT: Settings = {
  id: 1,
  restaurant_name: process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Mi Restaurante",
  logo_url: null,
  favicon_url: null,
  address: process.env.NEXT_PUBLIC_RESTAURANT_ADDRESS ?? null,
  phone: process.env.NEXT_PUBLIC_RESTAURANT_PHONE ?? null,
  rfc: process.env.NEXT_PUBLIC_RESTAURANT_RFC ?? null,
  tax_enabled: process.env.NEXT_PUBLIC_SHOW_TAX === "true",
  tax_rate: parseFloat(process.env.NEXT_PUBLIC_TAX_RATE ?? "18"),
  tax_label: process.env.NEXT_PUBLIC_TAX_LABEL ?? "ITBIS",
  tax_inclusive: true,
  auto_print_kitchen: false,
  enable_online_payment: false,
  enable_qr_tip: false,
  enable_qr_ordering: true,
  loyalty_enabled: false,
  loyalty_points_per_currency: 1,
  manager_pin: null,
  rnc: null,
  razon_social: null,
  ncf_default_type: "B02",
  updated_at: new Date(0).toISOString(),
};

// Cache por tenant_id. Si no hay tenant_id se cachea como "global"
// (legacy compat — para el-buen-comer al cargar URLs viejas).
const cache = new Map<string, Settings>();
const pending = new Map<string, Promise<Settings>>();

/**
 * Lee settings del tenant.
 * - Si pasas tenantId → eq("restaurant_id", tenantId)
 * - Si no, fallback al row con id=1 (compat con tenant inicial
 *   antes de F1, no debería ocurrir post-migración pero mantiene
 *   el contrato de la API).
 */
export async function getSettings(tenantId?: string): Promise<Settings> {
  const key = tenantId ?? "_legacy";
  const cached = cache.get(key);
  if (cached) return cached;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const supabase = createClient();
  const p = (async () => {
    const q = supabase.from("settings").select("*");
    const filtered = tenantId
      ? q.eq("restaurant_id", tenantId)
      : q.eq("id", 1);
    const { data, error } = await filtered.maybeSingle();
    const value = error || !data ? DEFAULT : { ...DEFAULT, ...data };
    cache.set(key, value);
    pending.delete(key);
    return value;
  })();
  pending.set(key, p);
  return p;
}

export function clearSettingsCache() {
  cache.clear();
  pending.clear();
}
