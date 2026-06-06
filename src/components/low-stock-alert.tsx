"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Ingredient } from "@/lib/types";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function LowStockAlert() {
  const [lowStock, setLowStock] = useState<Ingredient[]>([]);
  const supabase = createClient();

  async function checkStock() {
    const { data } = await supabase
      .from("ingredients")
      .select("*")
      .gt("min_stock", 0);

    if (data) {
      setLowStock(data.filter((i) => Number(i.stock) <= Number(i.min_stock)));
    }
  }

  useEffect(() => {
    checkStock();

    const channel = supabase
      .channel("low-stock-alert")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ingredients" },
        () => checkStock()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (lowStock.length === 0) return null;

  return (
    <Link href="/admin/inventory">
      <div className="flex items-center gap-1.5 bg-orange-100 text-orange-800 border border-orange-300 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-orange-200 transition-colors cursor-pointer">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          {lowStock.length} ingrediente{lowStock.length > 1 ? "s" : ""} con stock bajo
        </span>
      </div>
    </Link>
  );
}
