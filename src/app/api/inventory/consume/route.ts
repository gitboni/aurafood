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

  if (!items?.length) return NextResponse.json({ ok: true });

  // Load all recipes for the products in this order
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: recipes } = await supabase
    .from("product_recipes")
    .select("product_id, ingredient_id, quantity")
    .in("product_id", productIds);

  if (!recipes?.length) return NextResponse.json({ ok: true });

  // Calculate total consumption per ingredient
  const consumption: Record<string, number> = {};
  for (const item of items) {
    const itemRecipes = recipes.filter((r) => r.product_id === item.product_id);
    for (const r of itemRecipes) {
      consumption[r.ingredient_id] =
        (consumption[r.ingredient_id] ?? 0) + r.quantity * item.quantity;
    }
  }

  // Deduct stock for each ingredient and record movement
  const movements = Object.entries(consumption).map(([ingredient_id, qty]) => ({
    ingredient_id,
    type: "sale" as const,
    quantity: -qty,
    reference_id: order_id,
    notes: null,
  }));

  // Insert movements
  await supabase.from("stock_movements").insert(movements);

  // Update ingredient stocks (rpc would be ideal, but we update individually)
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

  return NextResponse.json({ ok: true, consumed: consumption });
}
