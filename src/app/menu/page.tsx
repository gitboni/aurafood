"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category, Product } from "@/lib/types";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").eq("active", true).order("sort_order"),
        supabase.from("products").select("*").eq("available", true).order("sort_order"),
      ]);
      if (catRes.data) {
        setCategories(catRes.data);
        if (catRes.data.length > 0) setActiveCategory(catRes.data[0].id);
      }
      if (prodRes.data) setProducts(prodRes.data);
    }
    load();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchCategory = !activeCategory || p.category_id === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featured = products.filter((p) => p.featured);

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold">🍽️ AuraFood</h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-6">
        {/* Welcome */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Nuestro Menú</h2>
          <p className="text-sm text-muted-foreground">Descubre todo lo que tenemos para ti</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en el menú..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Featured */}
        {featured.length > 0 && !search && (
          <section>
            <h3 className="text-lg font-semibold mb-3">⭐ Destacados</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {featured.map((p) => (
                <Card key={p.id} className="min-w-[160px] p-3 shrink-0">
                  {p.image_url && (
                    <div className="h-24 bg-muted rounded-md mb-2 overflow-hidden">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-orange-600 font-bold text-sm">${p.price.toFixed(2)}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {!search && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                size="sm"
                className={`shrink-0 rounded-full ${activeCategory === cat.id ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {/* Products */}
        <div className="space-y-3 pb-8">
          {filteredProducts.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-3">
              {p.image_url && (
                <div className="h-16 w-16 bg-muted rounded-lg overflow-hidden shrink-0">
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.featured && <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0">⭐</Badge>}
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-orange-600 font-bold">${p.price.toFixed(2)}</p>
              </div>
            </Card>
          ))}
          {filteredProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No se encontraron productos</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t py-4 mt-auto">
        <p className="text-center text-xs text-muted-foreground">
          🍽️ AuraFood — Haz tu pedido en caja
        </p>
      </footer>
    </main>
  );
}
