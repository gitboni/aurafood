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
  updated_at: new Date(0).toISOString(),
};

let cache: Settings | null = null;
let pending: Promise<Settings> | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  if (pending) return pending;
  const supabase = createClient();
  pending = (async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    const value = error || !data ? DEFAULT : { ...DEFAULT, ...data };
    cache = value;
    pending = null;
    return value;
  })();
  return pending;
}

export function clearSettingsCache() {
  cache = null;
}
