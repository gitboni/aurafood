-- ============================================================
-- AuraFood — PATCH 7
-- Anuncios globales del super_admin → aparecen como banner en todas
-- las pantallas /r/[slug]/* de todos los tenants.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info'
              CHECK (type IN ('info','warning','maintenance','success')),
  active      boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON public.announcements (active, expires_at);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquiera puede ver anuncios activos vigentes
DROP POLICY IF EXISTS "announcements_public_read" ON public.announcements;
CREATE POLICY "announcements_public_read"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- Super_admin ve todos (incluidos expirados/inactivos para gestión)
DROP POLICY IF EXISTS "announcements_super_read" ON public.announcements;
CREATE POLICY "announcements_super_read"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Solo super_admin escribe
DROP POLICY IF EXISTS "announcements_super_write" ON public.announcements;
CREATE POLICY "announcements_super_write"
  ON public.announcements FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- FIN PATCH 7
-- ============================================================
