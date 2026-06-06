-- ============================================================
-- AuraFood — Inventory Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Ingredients (raw materials / insumos)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  unit          text NOT NULL DEFAULT 'pza',  -- g, kg, mL, L, pza, porción
  stock         decimal(12,3) DEFAULT 0,
  min_stock     decimal(12,3) DEFAULT 0,       -- low-stock alert
  cost_per_unit decimal(10,2) DEFAULT 0,       -- cost per 1 unit
  created_at    timestamptz DEFAULT now()
);

-- 2. Product recipes (maps products → ingredients with quantity per serving)
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity      decimal(12,3) NOT NULL DEFAULT 1,  -- amount of ingredient per 1 unit sold
  created_at    timestamptz DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- 3. Stock movements (audit trail)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  type          text NOT NULL CHECK (type IN ('sale','purchase','adjustment','waste')),
  quantity      decimal(12,3) NOT NULL,  -- negative = consumed, positive = added
  reference_id  uuid,                    -- order_id when type = 'sale'
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 4. Enable Row Level Security
ALTER TABLE public.ingredients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 5. Policies — authenticated users have full access
CREATE POLICY "auth_all_ingredients"     ON public.ingredients     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_recipes"         ON public.product_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_movements"       ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon can READ (needed for recipe look-ups during order placement)
CREATE POLICY "anon_read_ingredients"    ON public.ingredients     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_recipes"        ON public.product_recipes FOR SELECT TO anon USING (true);
