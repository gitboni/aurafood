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
  X,
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
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
        if (catRes.data) setCategories(catRes.data);
        if (prodRes.data) setProducts(prodRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cartCount = count();
  const cartTotal = total();
  const featured = products.filter((p) => p.featured);

  // When searching: flat results. Otherwise: grouped by category.
  const searchResults = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  const productsByCategory = categories
    .map((cat) => ({
      cat,
      items: products.filter((p) => p.category_id === cat.id),
    }))
    .filter(({ items }) => items.length > 0);

  function scrollToSection(catId: string) {
    document.getElementById(`section-${catId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActiveSection(catId);
  }

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

      if (orderError || !order) throw orderError ?? new Error();

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
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold tracking-tight">🍽️ {RESTAURANT_NAME}</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="relative gap-1.5"
              onClick={() => setCartOpen(true)}
              disabled={cartCount === 0}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Carrito</span>
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-orange-500 text-[10px] text-white">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en el menú..."
              className="pl-9 h-9 bg-white/80 dark:bg-gray-800/80"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Category nav (hidden when searching) ── */}
      {!search && categories.length > 0 && (
        <div className="sticky top-[105px] z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b">
          <div className="max-w-lg mx-auto px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeSection === cat.id ? "default" : "ghost"}
                size="sm"
                className={`shrink-0 rounded-full text-xs h-7 ${
                  activeSection === cat.id
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "text-muted-foreground"
                }`}
                onClick={() => scrollToSection(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-lg mx-auto w-full px-4 pb-32 pt-5 space-y-8">
        {/* Hero */}
        {!search && (
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-extrabold">{RESTAURANT_NAME}</h2>
            <p className="text-sm text-muted-foreground">
              Explora nuestro menú y haz tu pedido
            </p>
          </div>
        )}

        {/* ── Search results ── */}
        {searchResults && (
          <section>
            <p className="text-sm text-muted-foreground mb-3">
              {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""} para &quot;{search}&quot;
            </p>
            {searchResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No se encontraron productos
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    cartItem={items.find((i) => i.product.id === p.id)}
                    onAdd={() => addItem(p)}
                    onInc={() => addItem(p)}
                    onDec={() => {
                      const ci = items.find((i) => i.product.id === p.id);
                      if (ci) updateQuantity(p.id, ci.quantity - 1);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Full menu by category ── */}
        {!searchResults && (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <section>
                <SectionTitle>⭐ Destacados</SectionTitle>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x no-scrollbar">
                  {featured.map((p) => (
                    <Card
                      key={p.id}
                      className="min-w-[148px] max-w-[148px] overflow-hidden shrink-0 snap-start hover:shadow-lg transition-shadow"
                    >
                      {p.image_url && (
                        <div className="relative h-24 overflow-hidden bg-muted">
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-2.5 space-y-1.5">
                        <p className="font-semibold text-xs leading-snug line-clamp-2">
                          {p.name}
                        </p>
                        <p className="text-orange-600 font-bold text-xs">
                          ${p.price.toFixed(2)}
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-6 text-[10px] bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => addItem(p)}
                        >
                          <Plus className="h-2.5 w-2.5 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Category sections */}
            {productsByCategory.map(({ cat, items: catItems }) => (
              <section
                key={cat.id}
                id={`section-${cat.id}`}
                className="scroll-mt-[160px]"
              >
                <SectionTitle>{cat.name}</SectionTitle>
                {cat.description && (
                  <p className="text-sm text-muted-foreground mb-3 -mt-1">
                    {cat.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {catItems.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      cartItem={items.find((i) => i.product.id === p.id)}
                      onAdd={() => addItem(p)}
                      onInc={() => addItem(p)}
                      onDec={() => {
                        const ci = items.find((i) => i.product.id === p.id);
                        if (ci) updateQuantity(p.id, ci.quantity - 1);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {/* ── Floating cart ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <Button
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-2xl rounded-full px-8 gap-3 h-12"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-bold">{cartCount} items</span>
            <Separator orientation="vertical" className="h-4 bg-orange-300" />
            <span className="font-bold">${cartTotal.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t py-3 mt-auto">
        <p className="text-center text-xs text-muted-foreground">
          🍽️ {RESTAURANT_NAME} — Realiza tu pedido y sigue su estado en tiempo real
        </p>
      </footer>

      {/* ── Cart Sheet ── */}
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
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => addItem(item.product)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.product.id)}>
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
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Mesa (opcional)</Label>
                <Input
                  placeholder="Ej: 3"
                  value={customerTable}
                  onChange={(e) => setCustomerTable(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <Input
              placeholder="Notas especiales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9"
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

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2">
      {children}
    </h3>
  );
}

function ProductCard({
  product: p,
  cartItem,
  onAdd,
  onInc,
  onDec,
}: {
  product: Product;
  cartItem: { quantity: number } | undefined;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {p.image_url && (
        <div className="relative h-28 bg-muted overflow-hidden shrink-0">
          <Image src={p.image_url} alt={p.name} fill className="object-cover" />
          {p.featured && (
            <Badge className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0">
              ⭐
            </Badge>
          )}
        </div>
      )}
      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
        <div className="flex-1">
          <div className="flex items-start gap-1">
            <p className="font-semibold text-sm leading-snug flex-1">{p.name}</p>
            {!p.image_url && p.featured && (
              <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1 py-0 shrink-0">
                ⭐
              </Badge>
            )}
          </div>
          {p.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
              {p.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <p className="text-orange-600 font-bold text-sm">${p.price.toFixed(2)}</p>
          {cartItem ? (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-6 w-6" onClick={onDec}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center text-xs font-bold">{cartItem.quantity}</span>
              <Button size="icon" variant="outline" className="h-6 w-6" onClick={onInc}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5"
              onClick={onAdd}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
