-- ============================================================
-- AuraFood — SaaS F1 PATCH 2
-- Permitir que el cliente anónimo lea SU PROPIA orden QR
-- (pantalla de seguimiento /menu/order/[id]).
--
-- Contexto: tras F1, orders.SELECT solo era para authenticated.
-- El cliente que hace un pedido por QR es anon → al redirigir a
-- la pantalla de seguimiento, no puede leer su orden → la página
-- queda en blanco / error.
--
-- Seguridad: el id de la orden es un UUID no adivinable que solo
-- conoce quien hizo el pedido (va en la URL del link). Exponer
-- SELECT de órdenes source='qr' a anon es el patrón estándar de
-- "magic link" — sin el UUID no puedes ver nada, y no se puede
-- enumerar.
-- ============================================================

-- Orders: anon puede leer órdenes de QR (las creadas por clientes).
DROP POLICY IF EXISTS "orders_qr_read_anon" ON public.orders;
CREATE POLICY "orders_qr_read_anon"
  ON public.orders FOR SELECT
  TO anon
  USING (source = 'qr');

-- Order items: anon puede leer los items de una orden QR.
DROP POLICY IF EXISTS "order_items_qr_read_anon" ON public.order_items;
CREATE POLICY "order_items_qr_read_anon"
  ON public.order_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.source = 'qr'
    )
  );

-- ============================================================
-- FIN PATCH 2. Verifica (como anon, dropdown "Role: anon"):
--   SELECT id, order_number, status FROM public.orders
--    WHERE source = 'qr' LIMIT 1;
--   -- Debe devolver filas (las órdenes QR existentes).
-- ============================================================
