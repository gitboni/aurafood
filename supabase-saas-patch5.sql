-- ============================================================
-- AuraFood — PATCH 5
-- Atributos enriquecidos de producto para el menú digital:
--   • tags dietéticos (veg, vegano, picante, sin gluten, etc.)
--   • alérgenos, calorías, tamaño de porción
--   • multi-idioma (inglés) — name_en / description_en
--
-- Todo es aditivo y opcional (NULL/default vacío). El menú y el
-- admin caen al comportamiento actual si están vacíos.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags          text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergens     text,
  ADD COLUMN IF NOT EXISTS calories      integer,
  ADD COLUMN IF NOT EXISTS portion_size  text,
  ADD COLUMN IF NOT EXISTS name_en       text,
  ADD COLUMN IF NOT EXISTS description_en text;

-- Índice GIN para filtrar por tag rápido (ej. "solo vegetariano")
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN (tags);

-- ============================================================
-- Valores sugeridos para tags (no es un CHECK, son convención):
--   'veg'        🌱 Vegetariano
--   'vegan'      🌿 Vegano
--   'spicy'      🌶️ Picante
--   'gluten_free' 🚫🌾 Sin gluten
--   'lactose_free' 🥛 Sin lactosa
--   'new'        ✨ Nuevo
--   'popular'    🔥 Popular
-- ============================================================
