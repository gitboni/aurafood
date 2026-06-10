-- ============================================================
-- AuraFood — SaaS F1 PATCH 3
-- Arreglar el crash del trigger auto_fill en audit_log cuando no
-- hay contexto de tenant (ej. cambios desde el SQL Editor, o
-- acciones globales del super_admin).
--
-- Síntoma: "Cannot insert into audit_log without restaurant_id
-- (no tenant context)" al hacer UPDATE en cualquier tabla auditada
-- desde un contexto sin sesión/JWT.
--
-- Causa: audit_log.restaurant_id es NOT NULL y auto_fill_restaurant_id
-- lanza EXCEPTION si current_restaurant_id() es null. El trigger de
-- auditoría escribe en audit_log sin tenant context → revienta.
--
-- Fix:
--   1. audit_log.restaurant_id pasa a NULLABLE (un log de sistema
--      puede no tener tenant — ej. acción global de super_admin)
--   2. Quitar el trigger auto_fill de audit_log (no lo necesita;
--      el audit_trigger ya intenta poblarlo, y si no hay, queda null)
--   3. auto_fill_restaurant_id deja de lanzar EXCEPTION — si no hay
--      contexto, deja el valor como está (las columnas NOT NULL
--      seguirán rechazando inserts inválidos de forma natural)
-- ============================================================

-- 1. audit_log.restaurant_id nullable
ALTER TABLE public.audit_log ALTER COLUMN restaurant_id DROP NOT NULL;

-- 2. Quitar el trigger de auto-fill SOLO de audit_log
DROP TRIGGER IF EXISTS trg_autofill_tenant ON public.audit_log;

-- 3. auto_fill ya no revienta: si no hay contexto, deja NEW como está.
--    Las tablas con restaurant_id NOT NULL rechazarán igual los
--    inserts sin tenant (comportamiento correcto), pero sin abortar
--    cadenas de triggers ajenas (como la auditoría).
CREATE OR REPLACE FUNCTION public.auto_fill_restaurant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    NEW.restaurant_id := public.current_restaurant_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- FIN PATCH 3.
-- Tras esto puedes hacer cambios desde el SQL Editor sin que el
-- trigger de auditoría aborte la operación.
-- ============================================================
