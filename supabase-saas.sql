-- ============================================================
-- AuraFood — SaaS Multi-Tenant Foundation (F1)
-- Run in Supabase SQL Editor. Safe to re-run (idempotente).
--
-- Estrategia:
--   1. Crear tabla `restaurants` (tenants)
--   2. Crear helpers: current_restaurant_id(), is_super_admin()
--   3. Extender `profiles` con restaurant_id y rol super_admin
--   4. Sembrar tenant inicial "el-buen-comer" + promover usuario actual
--   5. Para cada tabla operativa: ADD COLUMN restaurant_id (NULLABLE)
--      → BACKFILL con tenant inicial → SET NOT NULL → FK + índice
--   6. Reescribir TODAS las policies RLS para filtrar por tenant
--      (super_admin bypasa)
--
-- Después de correr esto:
--   • Toda la data existente queda asignada a "el-buen-comer"
--   • Tu usuario es super_admin (puedes crear más restaurantes)
--   • Las queries del código viejo SIGUEN funcionando (porque ya
--     pasan por RLS que filtra por restaurant_id del JWT)
--
-- Lo que SIGUE depende de pasos en código (no van en SQL):
--   • Middleware Next.js para extraer slug y meter restaurant_id en JWT
--   • Rutas /r/[slug]/...
--   • Redirect 301 de /menu, /pos, etc. → /r/el-buen-comer/...
--   • Panel super_admin
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 1 · TABLA `restaurants` (tenants)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.restaurants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  owner_id        uuid REFERENCES auth.users(id),
  -- Plan / billing
  plan            text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','free','pro','enterprise')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','suspended','cancelled')),
  trial_ends_at   timestamptz DEFAULT (now() + interval '14 days'),
  -- Metadata
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  -- Validación de slug: solo letras minúsculas, números, guiones
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(slug) BETWEEN 3 AND 40)
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants (slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON public.restaurants (owner_id);


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 2 · HELPERS (current_restaurant_id, is_super_admin)
-- ────────────────────────────────────────────────────────────

-- Lee el restaurant_id desde el profile del usuario.
-- IMPORTANT: este es el "default" si no hay claim en el JWT.
-- Para super_admin: este claim puede sobrescribirse vía JWT custom
-- claim que el middleware Next.js inyectará al cambiar de tenant
-- en el panel super_admin (impersonate).
CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- 1) Preferir custom claim del JWT si existe (super_admin impersonate)
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'restaurant_id', '')::uuid,
    -- 2) Si no, el del profile
    (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Actualizar la is_admin existente: ahora "admin DEL tenant actual"
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'super_admin' OR
        (role = 'admin' AND restaurant_id = public.current_restaurant_id())
      )
  );
$$;


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 3 · `profiles` extendido (restaurant_id + super_admin)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Permitir rol super_admin (relajar el CHECK existente)
DO $$
DECLARE conname text;
BEGIN
  SELECT conname INTO conname
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND conname LIKE '%role%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','cashier','kitchen'));

CREATE INDEX IF NOT EXISTS idx_profiles_restaurant ON public.profiles (restaurant_id);


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 4 · SEED — tenant inicial + super_admin
-- ────────────────────────────────────────────────────────────

-- Crear el tenant "el-buen-comer" si no existe
INSERT INTO public.restaurants (slug, name, plan, status, trial_ends_at)
VALUES ('el-buen-comer', 'El Buen Comer', 'enterprise', 'active', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Promover al usuario delgadobonifacior@gmail.com a super_admin
-- (también queda con un restaurant_id default = el-buen-comer)
DO $$
DECLARE
  v_user_id     uuid;
  v_tenant_id   uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'delgadobonifacior@gmail.com'
  LIMIT 1;

  SELECT id INTO v_tenant_id
  FROM public.restaurants
  WHERE slug = 'el-buen-comer';

  IF v_user_id IS NOT NULL THEN
    -- Asegurar que tiene profile
    INSERT INTO public.profiles (id, role, display_name, restaurant_id)
    VALUES (v_user_id, 'super_admin', 'Super Admin', v_tenant_id)
    ON CONFLICT (id) DO UPDATE
       SET role = 'super_admin',
           restaurant_id = COALESCE(public.profiles.restaurant_id, EXCLUDED.restaurant_id);
    -- También dejarlo como owner del primer tenant
    UPDATE public.restaurants SET owner_id = v_user_id WHERE id = v_tenant_id;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 5 · ADD `restaurant_id` A TABLAS OPERATIVAS
--
-- Para cada tabla:
--   1) ADD COLUMN nullable
--   2) BACKFILL con el tenant "el-buen-comer"
--   3) SET NOT NULL
--   4) FK + índice
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_tenant_id uuid;
  v_tbl       text;
  -- Solo tablas operativas con datos del restaurante.
  -- (Excluidas: restaurants, profiles, auth.*)
  v_tables    text[] := ARRAY[
    'settings',
    'categories',
    'products',
    'orders',
    'order_items',
    'refunds',
    'customers',
    'ingredients',
    'stock_movements',
    'product_recipes',
    'floor_tables',
    'locations',
    'modifier_groups',
    'modifiers',
    'product_modifier_groups',
    'combos',
    'combo_items',
    'shifts',
    'cash_movements',
    'audit_log'
  ];
BEGIN
  SELECT id INTO v_tenant_id FROM public.restaurants WHERE slug = 'el-buen-comer';

  FOREACH v_tbl IN ARRAY v_tables LOOP
    -- Saltar si la tabla aún no existe en este proyecto
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_tbl
    ) THEN
      RAISE NOTICE 'Tabla % no existe, saltando', v_tbl;
      CONTINUE;
    END IF;

    -- 1) Agregar columna nullable si no existe
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS restaurant_id uuid',
      v_tbl
    );

    -- 2) Backfill: todo lo huérfano queda en "el-buen-comer"
    EXECUTE format(
      'UPDATE public.%I SET restaurant_id = %L WHERE restaurant_id IS NULL',
      v_tbl, v_tenant_id
    );

    -- 3) NOT NULL
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN restaurant_id SET NOT NULL',
      v_tbl
    );

    -- 4) FK + índice
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE',
        v_tbl, v_tbl || '_restaurant_fk'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (restaurant_id)',
      'idx_' || v_tbl || '_restaurant', v_tbl
    );

    RAISE NOTICE 'Tabla % migrada a multi-tenant', v_tbl;
  END LOOP;
END $$;

-- `settings` ya no es single-row global. Quitar el CHECK id=1.
DO $$
DECLARE conname text;
BEGIN
  SELECT conname INTO conname
  FROM pg_constraint
  WHERE conrelid = 'public.settings'::regclass AND contype = 'c' AND conname LIKE '%single_row%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.settings DROP CONSTRAINT %I', conname);
  END IF;
END $$;

-- Reemplazar con: un row de settings por restaurante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.settings'::regclass AND conname = 'settings_one_per_tenant'
  ) THEN
    ALTER TABLE public.settings
      ADD CONSTRAINT settings_one_per_tenant UNIQUE (restaurant_id);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 6 · POLICIES RLS REESCRITAS (filtrar por tenant)
--
-- Patrón estándar por tabla:
--   • SELECT: restaurant_id = current_restaurant_id() OR is_super_admin()
--   • INSERT/UPDATE/DELETE: lo mismo + (is_admin() | rol específico)
--
-- Para que el menú QR siga siendo público (anon),
-- products/categories/settings/modifiers permiten SELECT abierto
-- al rol anon SI restaurant_id = current_restaurant_id().
-- ────────────────────────────────────────────────────────────

-- restaurants: solo super_admin ve TODO; cada usuario ve el suyo
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurants_read"  ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_admin" ON public.restaurants;
CREATE POLICY "restaurants_read" ON public.restaurants FOR SELECT TO authenticated
  USING (id = public.current_restaurant_id() OR public.is_super_admin());
CREATE POLICY "restaurants_admin" ON public.restaurants FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- profiles: ya tiene policies; refinar para que admins solo vean su tenant
DROP POLICY IF EXISTS "profiles_read"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    restaurant_id = public.current_restaurant_id() OR
    public.is_super_admin()
  );
CREATE POLICY "profiles_admin" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Helper macro mental: para cada tabla operativa, drop viejas y crear:
--   read_tenant : SELECT donde restaurant_id = current_restaurant_id() (+ anon para públicas)
--   write_tenant: ALL donde restaurant_id = current_restaurant_id() AND is_admin()

-- ── settings (lectura pública para QR / ticket) ──
DROP POLICY IF EXISTS "settings_read"  ON public.settings;
DROP POLICY IF EXISTS "settings_write" ON public.settings;
CREATE POLICY "settings_read" ON public.settings FOR SELECT TO anon, authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_super_admin());
CREATE POLICY "settings_write" ON public.settings FOR ALL TO authenticated
  USING ((restaurant_id = public.current_restaurant_id() AND public.is_admin()) OR public.is_super_admin())
  WITH CHECK ((restaurant_id = public.current_restaurant_id() AND public.is_admin()) OR public.is_super_admin());

-- ── categories, products, modifiers* (lectura pública para QR) ──
DO $$
DECLARE v_tbl text; v_tables text[] := ARRAY[
  'categories','products','modifier_groups','modifiers','product_modifier_groups','combos','combo_items','product_recipes'
];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_tbl) THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_read"  ON public.%I', v_tbl, v_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON public.%I', v_tbl, v_tbl);
    EXECUTE format(
      'CREATE POLICY "%s_read" ON public.%I FOR SELECT TO anon, authenticated USING (restaurant_id = public.current_restaurant_id() OR public.is_super_admin())',
      v_tbl, v_tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_write" ON public.%I FOR ALL TO authenticated USING ((restaurant_id = public.current_restaurant_id() AND public.is_admin()) OR public.is_super_admin()) WITH CHECK ((restaurant_id = public.current_restaurant_id() AND public.is_admin()) OR public.is_super_admin())',
      v_tbl, v_tbl
    );
  END LOOP;
END $$;

-- ── Tablas operativas privadas (no se leen como anon) ──
DO $$
DECLARE v_tbl text; v_tables text[] := ARRAY[
  'orders','order_items','refunds','customers',
  'ingredients','stock_movements',
  'floor_tables','locations',
  'shifts','cash_movements','audit_log'
];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_tbl) THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_read"  ON public.%I', v_tbl, v_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON public.%I', v_tbl, v_tbl);
    -- Lectura: cualquier autenticado del tenant
    EXECUTE format(
      'CREATE POLICY "%s_read" ON public.%I FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id() OR public.is_super_admin())',
      v_tbl, v_tbl
    );
    -- Escritura: cualquier autenticado del tenant (orders los crea cashier, etc.)
    EXECUTE format(
      'CREATE POLICY "%s_write" ON public.%I FOR ALL TO authenticated USING (restaurant_id = public.current_restaurant_id() OR public.is_super_admin()) WITH CHECK (restaurant_id = public.current_restaurant_id() OR public.is_super_admin())',
      v_tbl, v_tbl
    );
  END LOOP;
END $$;

-- order_items necesita además permitir INSERT desde anon (menú QR)
DROP POLICY IF EXISTS "order_items_qr_insert" ON public.order_items;
CREATE POLICY "order_items_qr_insert" ON public.order_items FOR INSERT TO anon
  WITH CHECK (
    restaurant_id = public.current_restaurant_id() AND
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND restaurant_id = public.current_restaurant_id() AND source = 'qr')
  );

-- orders necesita permitir INSERT desde anon (pedidos QR)
DROP POLICY IF EXISTS "orders_qr_insert" ON public.orders;
CREATE POLICY "orders_qr_insert" ON public.orders FOR INSERT TO anon
  WITH CHECK (restaurant_id = public.current_restaurant_id() AND source = 'qr');


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 7 · TRIGGER auto-fill restaurant_id en INSERT
--
-- Para que el código viejo siga funcionando sin pasar
-- restaurant_id explícito en cada INSERT, un trigger lo rellena
-- automáticamente con current_restaurant_id() si viene NULL.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_fill_restaurant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    NEW.restaurant_id := public.current_restaurant_id();
  END IF;
  IF NEW.restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot insert into % without restaurant_id (no tenant context)', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE v_tbl text; v_tables text[] := ARRAY[
  'settings','categories','products','orders','order_items','refunds',
  'customers','ingredients','stock_movements','product_recipes',
  'floor_tables','locations','modifier_groups','modifiers',
  'product_modifier_groups','combos','combo_items','shifts',
  'cash_movements','audit_log'
];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_tbl) THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_autofill_tenant ON public.%I', v_tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_autofill_tenant BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_fill_restaurant_id()',
      v_tbl
    );
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
-- SECCIÓN 8 · STORAGE — branding/{restaurant_id}/... aislado
-- ────────────────────────────────────────────────────────────

-- Política nueva: cada usuario solo puede escribir en la carpeta de SU tenant
-- (la lectura sigue siendo pública porque los logos van en tickets, menús, etc.)
DROP POLICY IF EXISTS "branding_write_tenant" ON storage.objects;
CREATE POLICY "branding_write_tenant" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding' AND
    (
      public.is_super_admin() OR
      (split_part(name, '/', 1) = public.current_restaurant_id()::text)
    )
  );

-- ============================================================
-- FIN F1. Verifica con:
--   SELECT slug, name, status FROM public.restaurants;
--   SELECT id, role, restaurant_id FROM public.profiles WHERE role = 'super_admin';
--   SELECT count(*) FROM public.products;  -- debe ser igual que antes
-- ============================================================
