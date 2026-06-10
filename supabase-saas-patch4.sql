-- ============================================================
-- AuraFood — SaaS PATCH 4
-- Notas internas por restaurante (CRM del super_admin).
-- Solo super_admin las lee/escribe (la policy de writes en
-- restaurants ya es is_super_admin()).
-- ============================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- (No se expone a anon: el SELECT público "restaurants_public_active"
--  solo se usa para resolver el slug; las apps cliente nunca piden
--  internal_notes. Para máxima paranoia podrías mover internal_notes
--  a una tabla aparte, pero con RLS de writes is_super_admin basta.)

-- ============================================================
-- FIN PATCH 4.
-- ============================================================
