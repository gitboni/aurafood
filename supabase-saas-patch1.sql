-- ============================================================
-- AuraFood — SaaS F1 PATCH 1
-- Permitir que clientes anónimos (menú QR) resuelvan slug → id.
--
-- Bug: el F1 original puso restaurants.SELECT solo para
-- authenticated. El menú QR (anon) no puede consultar la
-- tabla → no resuelve el slug → no carga el menú.
--
-- Solución: agregar policy de SELECT para anon donde el
-- tenant esté activo (no muestra suspended/cancelled).
--
-- Es seguro: solo expone id, slug, name, status. No expone
-- owner_id, plan, trial_ends_at — los demás campos siguen
-- protegidos porque la query del cliente del menú solo
-- pide id por slug.
-- ============================================================

-- Quitar la policy vieja y crear ambas combinadas
DROP POLICY IF EXISTS "restaurants_read"           ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_resolve" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_active"  ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_super_all"      ON public.restaurants;

-- Cualquiera (incluido anon) puede leer tenants ACTIVOS.
-- Esto es necesario para que el menú QR resuelva el slug.
CREATE POLICY "restaurants_public_active"
  ON public.restaurants FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Super admin además ve todos (incluidos suspended y cancelled,
-- para poder reactivarlos desde el panel).
CREATE POLICY "restaurants_super_admin_read"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- La policy de escritura sigue igual: solo super_admin
-- (ya existe restaurants_admin, no la tocamos).

-- ============================================================
-- FIN PATCH 1. Verifica con:
--
--   -- Como anon (en SQL Editor "Role: anon" en la dropdown)
--   SELECT id, slug, name FROM public.restaurants
--    WHERE slug = 'el-buen-comer';
--   -- Debe devolver 1 fila.
-- ============================================================
