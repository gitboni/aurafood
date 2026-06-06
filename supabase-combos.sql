-- ============================================================
-- AuraFood — Combos / Paquetes
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ── 1. Combos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.combos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  price       decimal(10,2) NOT NULL DEFAULT 0,
  featured    boolean DEFAULT false,
  available   boolean DEFAULT true,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── 2. Combo items (products inside each combo) ─────────────
CREATE TABLE IF NOT EXISTS public.combo_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id     uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity     int  NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON public.combo_items (combo_id);

-- ── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.combos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

-- Authenticated staff: full access. Anon: read only (for the QR menu).
DROP POLICY IF EXISTS "combos_auth"      ON public.combos;
DROP POLICY IF EXISTS "combos_anon_read" ON public.combos;
CREATE POLICY "combos_auth"      ON public.combos      FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "combos_anon_read" ON public.combos      FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "combo_items_auth"      ON public.combo_items;
DROP POLICY IF EXISTS "combo_items_anon_read" ON public.combo_items;
CREATE POLICY "combo_items_auth"      ON public.combo_items FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "combo_items_anon_read" ON public.combo_items FOR SELECT TO anon USING (true);
