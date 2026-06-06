import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ConsumeItem = { product_id: string; quantity: number };

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const body: { order_id: string; items: ConsumeItem[] } = await request.json();
  const { order_id, items } = body;

  if (!items?.length) return NextResponse.json({ ok: true, lowStock: [] });

  // Load recipes for all products in the order
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: recipes } = await supabase
    .from("product_recipes")
    .select("product_id, ingredient_id, quantity")
    .in("product_id", productIds);

  if (!recipes?.length) return NextResponse.json({ ok: true, lowStock: [] });

  // Calculate total consumption per ingredient
  const consumption: Record<string, number> = {};
  for (const item of items) {
    for (const r of recipes.filter((r) => r.product_id === item.product_id)) {
      consumption[r.ingredient_id] =
        (consumption[r.ingredient_id] ?? 0) + r.quantity * item.quantity;
    }
  }

  // Record movements and deduct stock
  const movements = Object.entries(consumption).map(([ingredient_id, qty]) => ({
    ingredient_id,
    type: "sale" as const,
    quantity: -qty,
    reference_id: order_id,
    notes: null,
  }));
  await supabase.from("stock_movements").insert(movements);

  for (const [ingredient_id, qty] of Object.entries(consumption)) {
    const { data: ing } = await supabase
      .from("ingredients")
      .select("stock")
      .eq("id", ingredient_id)
      .single();

    if (ing) {
      await supabase
        .from("ingredients")
        .update({ stock: Math.max(0, ing.stock - qty) })
        .eq("id", ingredient_id);
    }
  }

  // Return any affected ingredients that are now at or below min_stock
  const affectedIds = Object.keys(consumption);
  const { data: affected } = await supabase
    .from("ingredients")
    .select("id, name, unit, stock, min_stock")
    .in("id", affectedIds)
    .gt("min_stock", 0);

  const lowStock = (affected ?? []).filter(
    (i) => Number(i.stock) <= Number(i.min_stock)
  );

  return NextResponse.json({ ok: true, consumed: consumption, lowStock });
}
