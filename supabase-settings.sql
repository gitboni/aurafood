-- ============================================================
-- AuraFood — Settings (restaurant branding)
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
  id              int PRIMARY KEY DEFAULT 1,
  restaurant_name text DEFAULT 'Mi Restaurante',
  logo_url        text,
  address         text,
  phone           text,
  rfc             text,
  tax_enabled     boolean DEFAULT false,
  tax_rate        decimal(5,2) DEFAULT 16,
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT settings_single_row CHECK (id = 1)
);

-- Seed the single row
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read (QR menu + tickets), only admins can write
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read"  ON public.settings;
DROP POLICY IF EXISTS "settings_write" ON public.settings;
CREATE POLICY "settings_read"  ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_write" ON public.settings FOR ALL    TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Storage bucket for branding (logo) ──────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read, authenticated upload for the branding bucket
DROP POLICY IF EXISTS "branding_read"   ON storage.objects;
DROP POLICY IF EXISTS "branding_write"  ON storage.objects;
CREATE POLICY "branding_read"  ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'branding');
CREATE POLICY "branding_write" ON storage.objects FOR ALL    TO authenticated USING (bucket_id = 'branding') WITH CHECK (bucket_id = 'branding');
