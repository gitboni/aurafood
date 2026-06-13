// Cálculo de rentabilidad por producto.
// Se ejecuta en client (la pantalla principal es client component porque
// tiene filtros interactivos y simulador). Para velocidad llamamos a
// Supabase en paralelo y armamos el dataset en memoria.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductRow = {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  price: number;
  stored_cost: number;       // cost ya guardado en products.cost (puede ser 0)
  recipe_cost: number;       // costo recalculado desde la receta (puede ser 0)
  effective_cost: number;    // max(stored, recipe) — el más realista
  margin_amount: number;     // price - effective_cost
  margin_pct: number;        // (price - effective_cost) / price
  units_sold_30d: number;
  revenue_30d: number;
  profit_30d: number;
};

export type CategoryRow = {
  id: string;
  name: string;
  products: number;
  revenue_30d: number;
  profit_30d: number;
  avg_margin_pct: number;
};

/**
 * Pide a Supabase todos los datos necesarios para el dashboard de
 * rentabilidad de un tenant y los junta en arrays listos para tabla
 * y matriz BCG.
 */
export async function loadProfitabilityData(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ products: ProductRow[]; categories: CategoryRow[] }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [catRes, prodRes, recipeRes, salesRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("restaurant_id", tenantId),
    supabase
      .from("products")
      .select("id, name, category_id, price, cost")
      .eq("restaurant_id", tenantId),
    // Recetas + costo del ingrediente, para recalcular el costo real
    supabase
      .from("product_recipes")
      .select("product_id, quantity, ingredient:ingredients(cost_per_unit)")
      .eq("restaurant_id", tenantId),
    // Ventas reales de los últimos 30 días — solo órdenes "delivered"
    // (las canceladas no cuentan como venta efectiva).
    supabase
      .from("order_items")
      .select("product_id, quantity, subtotal, order:orders(status)")
      .eq("restaurant_id", tenantId)
      .gte("created_at", since),
  ]);

  const catMap = new Map<string, string>(
    (catRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
  );

  // Calcular costo de receta por producto.
  // Supabase tipa las relaciones como array (1:N) aunque sea single-row,
  // así que normalizamos a {cost_per_unit} o null.
  const recipeRows = (recipeRes.data ?? []) as unknown as Array<{
    product_id: string;
    quantity: number;
    ingredient: { cost_per_unit: number } | { cost_per_unit: number }[] | null;
  }>;
  const recipeCostByProduct = new Map<string, number>();
  for (const r of recipeRows) {
    const ing = Array.isArray(r.ingredient) ? r.ingredient[0] : r.ingredient;
    const cost = Number(r.quantity) * (Number(ing?.cost_per_unit) || 0);
    recipeCostByProduct.set(
      r.product_id,
      (recipeCostByProduct.get(r.product_id) ?? 0) + cost
    );
  }

  // Ventas por producto (solo delivered)
  const salesRows = (salesRes.data ?? []) as unknown as Array<{
    product_id: string | null;
    quantity: number;
    subtotal: number;
    order: { status: string } | { status: string }[] | null;
  }>;
  const unitsByProduct = new Map<string, number>();
  const revenueByProduct = new Map<string, number>();
  for (const it of salesRows) {
    if (!it.product_id) continue;
    const order = Array.isArray(it.order) ? it.order[0] : it.order;
    if (order?.status !== "delivered") continue;
    unitsByProduct.set(
      it.product_id,
      (unitsByProduct.get(it.product_id) ?? 0) + Number(it.quantity)
    );
    revenueByProduct.set(
      it.product_id,
      (revenueByProduct.get(it.product_id) ?? 0) + Number(it.subtotal)
    );
  }

  const products: ProductRow[] = ((prodRes.data ?? []) as Array<{
    id: string;
    name: string;
    category_id: string;
    price: number;
    cost: number;
  }>).map((p) => {
    const recipe_cost = recipeCostByProduct.get(p.id) ?? 0;
    const stored_cost = Number(p.cost) || 0;
    const effective_cost = Math.max(stored_cost, recipe_cost);
    const price = Number(p.price) || 0;
    const margin_amount = price - effective_cost;
    const margin_pct = price > 0 ? margin_amount / price : 0;
    const units_sold_30d = unitsByProduct.get(p.id) ?? 0;
    const revenue_30d = revenueByProduct.get(p.id) ?? 0;
    const profit_30d = units_sold_30d * margin_amount;
    return {
      id: p.id,
      name: p.name,
      category_id: p.category_id,
      category_name: catMap.get(p.category_id) ?? "—",
      price,
      stored_cost,
      recipe_cost,
      effective_cost,
      margin_amount,
      margin_pct,
      units_sold_30d,
      revenue_30d,
      profit_30d,
    };
  });

  // Agregado por categoría
  const catAgg = new Map<string, { products: number; revenue: number; profit: number; margin_sum: number }>();
  for (const p of products) {
    const a = catAgg.get(p.category_id) ?? { products: 0, revenue: 0, profit: 0, margin_sum: 0 };
    a.products += 1;
    a.revenue += p.revenue_30d;
    a.profit += p.profit_30d;
    a.margin_sum += p.margin_pct;
    catAgg.set(p.category_id, a);
  }
  const categories: CategoryRow[] = Array.from(catAgg.entries()).map(([id, a]) => ({
    id,
    name: catMap.get(id) ?? "—",
    products: a.products,
    revenue_30d: a.revenue,
    profit_30d: a.profit,
    avg_margin_pct: a.products > 0 ? a.margin_sum / a.products : 0,
  }));

  return { products, categories };
}

// ── Clasificación BCG ────────────────────────────────────────
// Comparamos cada producto contra la mediana de ventas y la mediana
// de margen del catálogo. 4 cuadrantes:
//   star          alto vol  + alto margen  → empújalo
//   cash_cow      alto vol  + bajo margen  → sube precio o reduce costo
//   question      bajo vol  + alto margen  → márketing / posición en el menú
//   dog           bajo vol  + bajo margen  → considera quitar
export type BcgQuadrant = "star" | "cash_cow" | "question" | "dog";
export const BCG_META: Record<BcgQuadrant, {
  label: string;
  color: string;
  hint: string;
}> = {
  star:     { label: "Estrella",      color: "bg-emerald-500", hint: "Vende mucho y deja buen margen — empújalo en el menú" },
  cash_cow: { label: "Vaca lechera",  color: "bg-blue-500",    hint: "Vende mucho pero deja poco — sube precio o baja costo" },
  question: { label: "Interrogante",  color: "bg-amber-500",   hint: "Buen margen pero no vende — dale más visibilidad" },
  dog:      { label: "Perro",         color: "bg-red-500",     hint: "Bajo volumen y bajo margen — considera quitarlo" },
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function classifyBcg(products: ProductRow[]): Map<string, BcgQuadrant> {
  const medVol = median(products.map((p) => p.units_sold_30d));
  const medMrg = median(products.map((p) => p.margin_pct));
  const out = new Map<string, BcgQuadrant>();
  for (const p of products) {
    const hiVol = p.units_sold_30d > medVol;
    const hiMrg = p.margin_pct > medMrg;
    out.set(
      p.id,
      hiVol && hiMrg ? "star"
        : hiVol && !hiMrg ? "cash_cow"
        : !hiVol && hiMrg ? "question"
        : "dog"
    );
  }
  return out;
}
