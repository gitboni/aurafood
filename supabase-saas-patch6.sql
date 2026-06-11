-- ============================================================
-- AuraFood — PATCH 6
-- Permitir vender COMBOS desde el menú QR.
--
-- order_items.product_id es NOT NULL + FK a products. Un combo no
-- es un producto, así que para registrarlo como línea de pedido:
--   • product_id pasa a NULLABLE
--   • se agrega combo_id (FK a combos)
-- Una línea de order_items será o un producto o un combo.
-- ============================================================

ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS combo_id uuid REFERENCES public.combos(id) ON DELETE SET NULL;

-- ============================================================
-- FIN PATCH 6.
-- ============================================================
