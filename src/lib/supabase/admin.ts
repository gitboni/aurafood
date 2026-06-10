import { createClient } from "@supabase/supabase-js";

// Cliente con SERVICE ROLE — bypasa RLS. SOLO usar en server actions /
// API routes, NUNCA en client components (expondría la llave maestra).
//
// Requiere la env var SUPABASE_SERVICE_ROLE_KEY (Settings → API en
// Supabase → service_role secret). En Vercel: Project → Settings →
// Environment Variables.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL en el entorno"
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
