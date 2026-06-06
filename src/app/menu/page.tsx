"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category, Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { ShoppingCart, Plus, Minus, Trash2, Send, Search, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTable, setCustomerTable] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [orderSent, setOrderSent] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const cart = useCartStore();
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

  async function submitOrder() {
    if (cart.count() === 0) return;
    setSending(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName || null,
          customer_table: customerTable || null,
          status: "pending",
          total: cart.total(),
          notes: orderNotes || null,
          source: "qr",
        })
        .select("id, order_number")
        .single();

      if (orderError) throw orderError;

      const items = cart.items.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        subtotal: i.product.price * i.quantity,
        notes: i.notes || null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) throw itemsError;

      setOrderSent(order.order_number);
      setOrderId(order.id);
      cart.clearCart();
      setOrderNotes("");
      toast.success("¡Pedido enviado!");
    } catch {
      toast.error("Error al enviar el pedido");
    } finally {
      setSending(false);
    }
  }

  if (orderSent) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h1 className="text-3xl font-bold">¡Pedido Enviado!</h1>
          <p className="text-muted-foreground text-lg">Tu número de orden es</p>
          <div className="text-6xl font-bold text-orange-500">#{orderSent}</div>
          <p className="text-muted-foreground">Te avisaremos cuando esté listo</p>
          {orderId && (
            <Link href={`/menu/order/${orderId}`}>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white mt-2">
                <Eye className="h-4 w-4 mr-2" />
                Ver estado de mi pedido
              </Button>
            </Link>
          )}
          <div>
            <Button
              onClick={() => { setOrderSent(null); setOrderId(null); }}
              variant="outline"
              className="mt-2"
            >
              Hacer otro pedido
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold">🍽️ AuraFood</h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent">
                <ShoppingCart className="h-5 w-5" />
                {cart.count() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cart.count()}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col">
                <SheetHeader>
                  <SheetTitle>Tu Pedido</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 -mx-6 px-6">
                  {cart.items.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Tu carrito está vacío</p>
                  ) : (
                    <div className="space-y-3">
                      {cart.items.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.product.name}</p>
                            <p className="text-sm text-orange-600 font-semibold">
                              ${(item.product.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7"
                              onClick={() => cart.updateQuantity(item.product.id, item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7"
                              onClick={() => cart.updateQuantity(item.product.id, item.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => cart.removeItem(item.product.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {cart.items.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <Input placeholder="Tu nombre (opcional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    <Input placeholder="Número de mesa (opcional)" value={customerTable} onChange={(e) => setCustomerTable(e.target.value)} />
                    <Textarea placeholder="Notas especiales..." value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} rows={2} />
                    <Separator />
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total</span>
                      <span className="text-orange-600">${cart.total().toFixed(2)}</span>
                    </div>
                    <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" size="lg" onClick={submitOrder} disabled={sending}>
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? "Enviando..." : "Enviar Pedido"}
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-6">
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
            <h2 className="text-lg font-semibold mb-3">⭐ Destacados</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {featured.map((p) => (
                <Card
                  key={p.id}
                  className="min-w-[160px] p-3 cursor-pointer hover:shadow-md transition-shadow shrink-0"
                  onClick={() => cart.addItem(p)}
                >
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
        <div className="space-y-3">
          {filteredProducts.map((p) => {
            const inCart = cart.items.find((i) => i.product.id === p.id);
            return (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                {p.image_url && (
                  <div className="h-16 w-16 bg-muted rounded-lg overflow-hidden shrink-0">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                  <p className="text-orange-600 font-bold text-sm mt-1">${p.price.toFixed(2)}</p>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => cart.updateQuantity(p.id, inCart.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{inCart.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => cart.updateQuantity(p.id, inCart.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600" onClick={() => cart.addItem(p)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No hay productos disponibles</p>
          )}
        </div>
      </div>

      {/* Floating cart bar */}
      {cart.count() > 0 && (
        <div className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t p-4">
          <div className="max-w-lg mx-auto">
            <Sheet>
              <SheetTrigger className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white h-11 px-6 font-medium">
                <ShoppingCart className="h-4 w-4" />
                Ver Pedido ({cart.count()}) — ${cart.total().toFixed(2)}
              </SheetTrigger>
            </Sheet>
          </div>
        </div>
      )}
    </main>
  );
}
