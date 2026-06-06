-- ============================================================
-- AuraFood — Features Schema (roles, shifts, modifiers, orders+)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================

-- ── 1. PROFILES (user roles) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','cashier','kitchen')),
  display_name text,
  created_at   timestamptz DEFAULT now()
);

-- Auto-create a profile when a new user signs up (first user becomes admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'cashier' END,
    split_part(NEW.email, '@', 1)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users (first one = admin)
INSERT INTO public.profiles (id, role, display_name)
SELECT u.id,
       CASE WHEN row_number() OVER (ORDER BY u.created_at) = 1 THEN 'admin' ELSE 'cashier' END,
       split_part(u.email, '@', 1)
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles);

-- ── 2. SHIFTS (cash register / corte Z) ─────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),
  user_name       text,
  opened_at       timestamptz DEFAULT now(),
  closed_at       timestamptz,
  opening_cash    decimal(10,2) DEFAULT 0,
  closing_cash    decimal(10,2),
  expected_cash   decimal(10,2),
  cash_difference decimal(10,2),
  total_sales     decimal(10,2) DEFAULT 0,
  total_orders    int DEFAULT 0,
  total_cancelled int DEFAULT 0,
  notes           text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

-- ── 3. MODIFIERS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modifier_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  required   boolean DEFAULT false,
  max_select int DEFAULT 1,          -- 1 = single choice, >1 = multi
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.modifiers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name       text NOT NULL,
  price      decimal(10,2) DEFAULT 0,
  available  boolean DEFAULT true,
  sort_order int DEFAULT 0
);

-- Junction: which modifier groups apply to which products
CREATE TABLE IF NOT EXISTS public.product_modifier_groups (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, group_id)
);

-- ── 4. ORDERS — new columns ─────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal         decimal(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_percent decimal(5,2)  DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount  decimal(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip              decimal(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method   text DEFAULT 'cash';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason    text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by     text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shift_id         uuid REFERENCES public.shifts(id);

-- ── 5. PRODUCTS — cost column (for margin reports) ──────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost decimal(10,2) DEFAULT 0;

-- ── 6. RLS ──────────────────────────────────────────────────
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

-- helper to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Profiles: everyone authenticated can read; users update own; admins manage all
DROP POLICY IF EXISTS "profiles_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin"  ON public.profiles;
CREATE POLICY "profiles_read"  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_admin" ON public.profiles FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Shifts: authenticated full access
DROP POLICY IF EXISTS "shifts_all" ON public.shifts;
CREATE POLICY "shifts_all" ON public.shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Modifiers: authenticated full access, anon read (needed for QR menu)
DROP POLICY IF EXISTS "mg_auth"  ON public.modifier_groups;
DROP POLICY IF EXISTS "mg_anon"  ON public.modifier_groups;
CREATE POLICY "mg_auth" ON public.modifier_groups FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mg_anon" ON public.modifier_groups FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "mod_auth" ON public.modifiers;
DROP POLICY IF EXISTS "mod_anon" ON public.modifiers;
CREATE POLICY "mod_auth" ON public.modifiers FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mod_anon" ON public.modifiers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "pmg_auth" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "pmg_anon" ON public.product_modifier_groups;
CREATE POLICY "pmg_auth" ON public.product_modifier_groups FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pmg_anon" ON public.product_modifier_groups FOR SELECT TO anon USING (true);
