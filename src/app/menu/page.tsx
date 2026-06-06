"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Category, Product } from "@/lib/types";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Loader2,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";

const RESTAURANT_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "El Buen Comer";
const ENABLE_PAYMENTS = process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === "true";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerTable, setCustomerTable] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  const { items, addItem, removeItem, updateQuantity, clearCart, total, count } =
    useCartStore();
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase.from("categories").select("*").eq("active", true).order("sort_order"),
          supabase.from("products").select("*").eq("available", true).order("sort_order"),
        ]);
        if (catRes.error) throw catRes.error;
        if (prodRes.error) throw prodRes.error;
        if (catRes.data) {
          setCategories(catRes.data);
          if (catRes.data.length > 0) setActiveCategory(catRes.data[0].id);
        }
        if (prodRes.data) setProducts(prodRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchCategory = !activeCategory || p.category_id === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featured = products.filter((p) => p.featured);
  const cartCount = count();
  const cartTotal = total();

  async function placeOrder(payOnline: boolean) {
    if (items.length === 0) return;
    setPlacing(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName || null,
          customer_table: customerTable || null,
          status: "pending",
          total: cartTotal,
          notes: notes || null,
          source: "qr",
        })
        .select()
        .single();

      if (orderError || !order) throw orderError ?? new Error("No order returned");

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        subtotal: i.product.price * i.quantity,
        notes: i.notes || null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      const savedItems = [...items];
      clearCart();
      setCartOpen(false);
      setCustomerName("");
      setCustomerTable("");
      setNotes("");

      if (payOnline) {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: savedItems.map((i) => ({
              name: i.product.name,
              quantity: i.quantity,
              price: i.product.price,
            })),
            orderId: order.id,
            orderNumber: order.order_number,
          }),
        });
        const data = await res.json();
        if (data.init_point) {
          window.location.href = data.init_point;
          return;
        }
        toast.error("No se pudo iniciar el pago online");
      }

      router.push(`/menu/order/${order.id}`);
    } catch {
      toast.error("Error al crear el pedido, intenta de nuevo");
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold">No se pudo cargar el menú</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold">🍽️ {RESTAURANT_NAME}</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => setCartOpen(true)}
              disabled={cartCount === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Carrito
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-orange-500 text-[10px] text-white">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-6 pb-28">
        {/* Welcome */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">{RESTAURANT_NAME}</h2>
          <p className="text-sm text-muted-foreground">
            Nuestro Menú — Descubre todo lo que tenemos para ti
          </p>
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
                    <div className="relative h-24 bg-muted rounded-md mb-2 overflow-hidden">
                      <Image src={p.image_url} alt={p.name} fill className="object-cover" />
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
                className={`shrink-0 rounded-full ${
                  activeCategory === cat.id ? "bg-orange-500 hover:bg-orange-600" : ""
                }`}
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
            const cartItem = items.find((i) => i.product.id === p.id);
            return (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                {p.image_url && (
                  <div className="relative h-16 w-16 bg-muted rounded-lg overflow-hidden shrink-0">
                    <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{p.name}</p>
                    {p.featured && (
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0">
                        ⭐
                      </Badge>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <p className="text-orange-600 font-bold text-sm mt-0.5">
                    ${p.price.toFixed(2)}
                  </p>
                </div>
                <div className="shrink-0">
                  {cartItem ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(p.id, cartItem.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-bold">
                        {cartItem.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => addItem(p)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => addItem(p)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No se encontraron productos
            </p>
          )}
        </div>
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <Button
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-2xl rounded-full px-8 gap-3"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-bold">{cartCount} items</span>
            <Separator orientation="vertical" className="h-4 bg-orange-300" />
            <span className="font-bold">${cartTotal.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t py-4 mt-auto">
        <p className="text-center text-xs text-muted-foreground">
          🍽️ {RESTAURANT_NAME} — Haz tu pedido y sigue su estado en tiempo real
        </p>
      </footer>

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Tu Pedido ({cartCount} items)</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 mt-2">
            <div className="space-y-3 pb-2">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-sm text-orange-600 font-semibold">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => addItem(item.product)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <SheetFooter className="flex-col gap-3 px-4 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tu nombre (opcional)</Label>
                <Input
                  placeholder="Ej: María"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Mesa (opcional)</Label>
                <Input
                  placeholder="Ej: 3"
                  value={customerTable}
                  onChange={(e) => setCustomerTable(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <Input
              placeholder="Notas especiales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Separator />
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total</span>
              <span className="text-orange-600">${cartTotal.toFixed(2)}</span>
            </div>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              size="lg"
              disabled={placing}
              onClick={() => placeOrder(false)}
            >
              {placing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {placing ? "Confirmando..." : "Confirmar Pedido"}
            </Button>
            {ENABLE_PAYMENTS && (
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                disabled={placing}
                onClick={() => placeOrder(true)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar con MercadoPago
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}
