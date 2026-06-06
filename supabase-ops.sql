-- ============================================================
-- AuraFood — Refunds + Audit Log
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ── 1. REFUNDS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount          decimal(10,2) NOT NULL,
  reason          text NOT NULL,
  refund_method   text NOT NULL DEFAULT 'cash' CHECK (refund_method IN ('cash','card','transfer','store_credit')),
  refunded_by     uuid REFERENCES auth.users(id),
  refunded_by_name text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds (order_id);

-- Mark on the order so reports can deduct it
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_amount decimal(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at     timestamptz;

-- Allow 'refunded' status
DO $$
BEGIN
  -- relax any existing CHECK on orders.status if present, then ensure new value works
  -- (Postgres has no easy alter-check; we just rely on the column being text.)
  NULL;
END $$;

-- Trigger: when a refund row is inserted, bump the order's refunded_amount and timestamp
CREATE OR REPLACE FUNCTION public.apply_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orders
     SET refunded_amount = COALESCE(refunded_amount, 0) + NEW.amount,
         refunded_at = COALESCE(refunded_at, now()),
         status = CASE
           WHEN COALESCE(refunded_amount, 0) + NEW.amount >= COALESCE(total, 0) THEN 'refunded'
           ELSE status
         END
   WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_refund ON public.refunds;
CREATE TRIGGER trg_apply_refund
  AFTER INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.apply_refund();

-- ── 2. AUDIT LOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  user_name   text,
  action      text NOT NULL,                 -- 'create' | 'update' | 'delete' | 'refund' | 'cancel' | 'login' | ...
  entity      text NOT NULL,                 -- 'product' | 'ingredient' | 'order' | 'settings' | ...
  entity_id   text,
  changes     jsonb,                         -- { field: { from, to } }  OR  full snapshot
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity  ON public.audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log (created_at DESC);

-- Generic trigger that records full-row diffs into audit_log
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname text;
  diff  jsonb;
BEGIN
  SELECT display_name INTO uname FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, user_name, action, entity, entity_id, changes)
    VALUES (auth.uid(), uname, 'create', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, jsonb_build_object('from', o.value, 'to', n.value))
      INTO diff
      FROM jsonb_each(to_jsonb(OLD)) o
      JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
      WHERE o.value IS DISTINCT FROM n.value;
    IF diff IS NOT NULL THEN
      INSERT INTO public.audit_log (user_id, user_name, action, entity, entity_id, changes)
      VALUES (auth.uid(), uname, 'update', TG_TABLE_NAME, NEW.id::text, diff);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, user_name, action, entity, entity_id, changes)
    VALUES (auth.uid(), uname, 'delete', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Audit the high-value tables
DROP TRIGGER IF EXISTS audit_products    ON public.products;
CREATE TRIGGER audit_products    AFTER INSERT OR UPDATE OR DELETE ON public.products    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_ingredients ON public.ingredients;
CREATE TRIGGER audit_ingredients AFTER INSERT OR UPDATE OR DELETE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_settings    ON public.settings;
CREATE TRIGGER audit_settings    AFTER INSERT OR UPDATE OR DELETE ON public.settings    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_orders      ON public.orders;
CREATE TRIGGER audit_orders      AFTER UPDATE OR DELETE                ON public.orders      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_profiles    ON public.profiles;
CREATE TRIGGER audit_profiles    AFTER UPDATE OR DELETE                ON public.profiles    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.refunds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refunds_all"  ON public.refunds;
CREATE POLICY "refunds_all" ON public.refunds FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "audit_read"   ON public.audit_log;
DROP POLICY IF EXISTS "audit_insert" ON public.audit_log;
-- Admins read all, authenticated insert (so the SECURITY DEFINER trigger works regardless of caller)
CREATE POLICY "audit_read"   ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
