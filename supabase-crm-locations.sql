-- ============================================================
-- AuraFood — Customers (CRM) + Locations (multi-sucursal)
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ── 1. Customers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text UNIQUE,
  name         text,
  total_orders int   DEFAULT 0,
  total_spent  decimal(10,2) DEFAULT 0,
  last_visit   timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);

-- Loyalty points balance (added later — safe to re-run)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points decimal(10,2) DEFAULT 0;

-- Link customers to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- ── 2. Locations (multi-sucursal) ───────────────────────────
-- The `locations` table already exists per the codebase; ensure RLS and seed.
CREATE TABLE IF NOT EXISTS public.locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text,
  phone      text,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed a default location if empty
INSERT INTO public.locations (name, address)
SELECT 'Sucursal Principal', 'Sucursal por defecto'
WHERE NOT EXISTS (SELECT 1 FROM public.locations);

-- ── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_auth" ON public.customers;
DROP POLICY IF EXISTS "customers_anon" ON public.customers;
CREATE POLICY "customers_auth" ON public.customers FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_anon" ON public.customers FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "locations_read"  ON public.locations;
DROP POLICY IF EXISTS "locations_admin" ON public.locations;
CREATE POLICY "locations_read"  ON public.locations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "locations_admin" ON public.locations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 4. Trigger: roll up customer stats on delivered orders ──
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'delivered' AND
     (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
    UPDATE public.customers
       SET total_orders = total_orders + 1,
           total_spent  = total_spent + COALESCE(NEW.total, 0),
           last_visit   = COALESCE(NEW.updated_at, now())
     WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_stats ON public.orders;
CREATE TRIGGER trg_customer_stats
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_stats();
