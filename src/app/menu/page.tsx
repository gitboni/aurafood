"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Category, Product, ModifierGroup, SelectedModifier } from "@/lib/types";
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
  Check,
  ZoomIn,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModifierPicker } from "@/components/modifier-picker";
import { useCartStore, lineKeyOf, lineUnitPrice } from "@/lib/store";
import { toast } from "sonner";
import { TAG_BY_VALUE } from "@/lib/product-tags";

const RESTAURANT_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "El Buen Comer";
const ENABLE_PAYMENTS = process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === "true";

type Lang = "es" | "en";
// Nombre/descripción según idioma (cae a ES si no hay traducción)
const pName = (p: Product, lang: Lang) =>
  lang === "en" && p.name_en ? p.name_en : p.name;
const pDesc = (p: Product, lang: Lang) =>
  lang === "en" && p.description_en ? p.description_en : p.description;

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTable, setCustomerTable] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("mesa") ?? "";
  });
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [tipPct, setTipPct] = useState(0);
  const [modGroups, setModGroups] = useState<Record<string, ModifierGroup[]>>({});
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [restaurantName, setRestaurantName] = useState(RESTAURANT_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrOrdering, setQrOrdering] = useState(true);
  const [qrTip, setQrTip] = useState(false);
  const [onlinePayment, setOnlinePayment] = useState(ENABLE_PAYMENTS);
  // ── Multi-tenant: resolver el restaurant_id antes de cargar nada
  const [tenantId, setTenantId] = useState<string | null>(null);
  // Idioma del menú (ES por defecto, EN si el restaurante tradujo)
  const [lang, setLang] = useState<"es" | "en">("es");

  const { items, addItem, removeItem, updateQuantity, clearCart, total, count } =
    useCartStore();
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Resolver el slug del tenant: si estamos en /r/[slug]/menu, sacarlo
    // del path; si no, default a 'el-buen-comer' (compat con URLs viejas
    // mientras F3.2 no termina de mover todo).
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const m = path.match(/^\/r\/([a-z0-9][a-z0-9-]*[a-z0-9])(?:\/|$)/);
    const slug = m ? m[1] : "el-buen-comer";

    async function bootstrap() {
      // 1. Resolver slug → id
      const { data: tenant, error: tErr } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (tErr || !tenant) {
        console.error("Tenant resolve error", { slug, error: tErr });
        setError(true);
        setLoading(false);
        return;
      }
      const tid = tenant.id;
      setTenantId(tid);

      // 2. Cargar categorías + productos filtrados por tenant
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase
            .from("categories")
            .select("*")
            .eq("restaurant_id", tid)
            .eq("active", true)
            .order("sort_order"),
          supabase
            .from("products")
            .select("*")
            .eq("restaurant_id", tid)
            .eq("available", true)
            .order("sort_order"),
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

      // 3. Modifiers + settings — paralelo, no bloquea el render
      loadModifiers(tid);
      supabase
        .from("settings")
        .select("*")
        .eq("restaurant_id", tid)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          if (data.restaurant_name) setRestaurantName(data.restaurant_name);
          if (data.logo_url) setLogoUrl(data.logo_url);
          setQrOrdering(data.enable_qr_ordering ?? true);
          setQrTip(data.enable_qr_tip ?? false);
          setOnlinePayment(data.enable_online_payment ?? ENABLE_PAYMENTS);
        });
    }
    bootstrap();
  }, []);

  async function loadModifiers(tid: string) {
    const { data, error } = await supabase
      .from("product_modifier_groups")
      .select("product_id, modifier_groups(*, modifiers(*))")
      .eq("restaurant_id", tid);
    if (error || !data) return;
    const map: Record<string, ModifierGroup[]> = {};
    for (const row of data as unknown as { product_id: string; modifier_groups: ModifierGroup | null }[]) {
      const g = row.modifier_groups;
      if (!g) continue;
      if (g.modifiers) g.modifiers.sort((a, b) => a.sort_order - b.sort_order);
      (map[row.product_id] ??= []).push(g);
    }
    for (const pid of Object.keys(map)) map[pid].sort((a, b) => a.sort_order - b.sort_order);
    setModGroups(map);
  }

  function handleAdd(p: Product) {
    if (modGroups[p.id]?.length) setPickerProduct(p);
    else addItem(p);
  }

  const cartCount = count();
  const cartSubtotal = total();
  const tipValue = +(cartSubtotal * (tipPct / 100)).toFixed(2);
  const cartTotal = +(cartSubtotal + tipValue).toFixed(2);
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
    if (!tenantId) {
      toast.error("No se pudo identificar el restaurante. Recarga la página.");
      return;
    }
    setPlacing(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: tenantId,
          customer_name: customerName || null,
          customer_phone: customerPhone.replace(/\D/g, "") || null,
          customer_table: customerTable || null,
          status: "pending",
          subtotal: cartSubtotal,
          tip: tipValue,
          total: cartTotal,
          notes: notes || null,
          source: "qr",
        })
        .select()
        .single();

      if (orderError || !order) throw orderError ?? new Error();

      const orderItems = items.map((i) => {
        const unit = lineUnitPrice(i);
        const modNote = (i.modifiers ?? []).map((m) => m.modifier_name).join(", ");
        const fullNote = [modNote, i.notes].filter(Boolean).join(" · ");
        return {
          restaurant_id: tenantId,
          order_id: order.id,
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: unit,
          subtotal: unit * i.quantity,
          notes: fullNote || null,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      const savedItems = [...items];
      clearCart();
      setCartOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerTable("");
      setNotes("");
      setTipPct(0);

      // Deduct inventory stock (fire-and-forget)
      fetch("/api/inventory/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          items: savedItems.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        }),
      }).catch(() => {});

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
    } catch (err) {
      console.error("placeOrder error:", err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`No se pudo crear el pedido: ${msg}`);
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex flex-col bg-gradient-to-br from-primary/5 to-gold/5 min-h-screen">
        {/* Header skeleton */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          </div>
          <div className="max-w-lg mx-auto px-4 pb-3">
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        {/* Product grid skeleton */}
        <div className="max-w-lg mx-auto w-full px-4 pt-5">
          <div className="h-6 w-32 rounded bg-muted animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="flex items-center justify-between pt-1">
                    <div className="h-5 w-12 rounded bg-muted animate-pulse" />
                    <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 to-gold/5 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold">No se pudo cargar el menú</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </main>
    );
  }

  // First product image for the hero blur backdrop
  const heroImg = products.find(p => p.featured && p.image_url)?.image_url
    ?? products.find(p => p.image_url)?.image_url
    ?? null;

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-primary/5 to-gold/5 min-h-screen relative overflow-hidden">
      {/* Hero blur backdrop */}
      {heroImg && (
        <div
          className="hero-blur-bg"
          style={{ backgroundImage: `url(${heroImg})` }}
          aria-hidden="true"
        />
      )}
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
            {logoUrl ? (
              <Image src={logoUrl} alt={restaurantName} width={32} height={32} className="rounded-lg object-cover h-8 w-8 ring-1 ring-black/5" />
            ) : (
              <span>🍽️</span>
            )}
            {restaurantName}
          </h1>
          <div className="flex items-center gap-2">
            {/* Toggle de idioma — solo si hay traducciones */}
            {products.some((p) => p.name_en) && (
              <button
                type="button"
                onClick={() => setLang((l) => (l === "es" ? "en" : "es"))}
                className="text-xs font-semibold px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
              >
                {lang === "es" ? "🇬🇧 EN" : "🇪🇸 ES"}
              </button>
            )}
            <ThemeToggle />
            {qrOrdering && (
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
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-[10px] text-primary-foreground">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en el menú..."
              className="pl-9 h-9 bg-card/80"
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
        <div className="sticky top-[105px] z-30 bg-background/80 backdrop-blur-sm border-b">
          <div className="max-w-lg mx-auto px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeSection === cat.id ? "default" : "ghost"}
                size="sm"
                className={`shrink-0 rounded-full text-xs h-7 ${
                  activeSection === cat.id
                    ? "bg-primary hover:bg-primary/90 text-white"
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
            <h2 className="font-display text-4xl font-medium tracking-tight text-primary">{restaurantName}</h2>
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
                    readOnly={!qrOrdering}
                    lang={lang}
                    hasModifiers={!!modGroups[p.id]?.length}
                    cartItem={items.find((i) => i.product.id === p.id)}
                    onAdd={() => handleAdd(p)}
                    onInc={() => handleAdd(p)}
                    onDec={() => {
                      const ci = items.find((i) => i.product.id === p.id);
                      if (ci) updateQuantity(lineKeyOf(ci.product.id, ci.modifiers), ci.quantity - 1);
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
                <SectionTitle><Star className="h-[18px] w-[18px] text-gold" fill="currentColor" /> {lang === "en" ? "Featured" : "Destacados"}</SectionTitle>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x no-scrollbar">
                  {featured.map((p) => (
                    <Card
                      key={p.id}
                      className="min-w-[148px] max-w-[148px] overflow-hidden shrink-0 snap-start hover:shadow-lg hover:scale-[1.03] transition-all duration-300"
                    >
                      {p.image_url && (
                        <div className="relative h-24 overflow-hidden bg-muted">
                          <Image
                            src={p.image_url}
                            alt={pName(p, lang)}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-2.5 space-y-1.5">
                        <p className="font-display font-semibold text-xs leading-snug line-clamp-2">
                          {pName(p, lang)}
                        </p>
                        <p className="font-display text-primary font-bold text-sm tabular">
                          ${p.price.toFixed(2)}
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-6 text-[10px] bg-primary hover:bg-primary/90 text-white"
                          onClick={() => addItem(p)}
                        >
                          <Plus className="h-2.5 w-2.5 mr-1" />
                          {lang === "en" ? "Add" : "Agregar"}
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
                      readOnly={!qrOrdering}
                      lang={lang}
                      hasModifiers={!!modGroups[p.id]?.length}
                      cartItem={items.find((i) => i.product.id === p.id)}
                      onAdd={() => handleAdd(p)}
                      onInc={() => handleAdd(p)}
                      onDec={() => {
                        const ci = items.find((i) => i.product.id === p.id);
                        if (ci) updateQuantity(lineKeyOf(ci.product.id, ci.modifiers), ci.quantity - 1);
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
      {qrOrdering && cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/25 rounded-full px-8 gap-3 h-12"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-bold">{cartCount} items</span>
            <Separator orientation="vertical" className="h-4 bg-primary-foreground/30" />
            <span className="font-bold">${cartTotal.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="bg-background/80 backdrop-blur-md border-t py-3 mt-auto">
        <p className="text-center text-xs text-muted-foreground">
          🍽️ {restaurantName} — Realiza tu pedido y sigue su estado en tiempo real
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
              {items.map((item) => {
                const key = lineKeyOf(item.product.id, item.modifiers);
                return (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    {(item.modifiers ?? []).length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.modifiers!.map((m) => m.modifier_name).join(", ")}
                      </p>
                    )}
                    <p className="text-sm text-primary font-semibold">
                      ${(lineUnitPrice(item) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => updateQuantity(key, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => addItem(item.product, item.modifiers)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(key)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                );
              })}
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
            <div>
              <Label className="text-xs">Teléfono (opcional)</Label>
              <Input
                type="tel"
                placeholder="Ej: 555 123 4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <Input
              placeholder="Notas especiales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9"
            />

            {/* Suggested tip */}
            {qrTip && (
              <div>
                <Label className="text-xs">¿Agregar propina?</Label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {[0, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTipPct(pct)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                        tipPct === pct
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {pct === 0 ? "No" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              {tipValue > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Propina ({tipPct}%)</span>
                  <span>+${tipValue.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg pt-1">
                <span>Total</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white"
              size="lg"
              disabled={placing}
              onClick={() => placeOrder(false)}
            >
              {placing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {placing ? "Confirmando..." : "Confirmar Pedido"}
            </Button>
            {onlinePayment && (
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

      {pickerProduct && (
        <ModifierPicker
          product={pickerProduct}
          groups={modGroups[pickerProduct.id] ?? []}
          onConfirm={(mods: SelectedModifier[]) => {
            addItem(pickerProduct, mods);
            setPickerProduct(null);
          }}
          onClose={() => setPickerProduct(null)}
        />
      )}
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
  hasModifiers,
  readOnly,
  lang,
  onAdd,
  onInc,
  onDec,
}: {
  product: Product;
  cartItem: { quantity: number } | undefined;
  hasModifiers?: boolean;
  readOnly?: boolean;
  lang: Lang;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const [justAdded, setJustAdded] = useState(false);
  const name = pName(p, lang);
  const desc = pDesc(p, lang);
  const tags = (p.tags ?? []).map((v) => TAG_BY_VALUE.get(v)).filter(Boolean);
  const hasDetail =
    !!desc || tags.length > 0 || !!p.allergens || !!p.calories || !!p.portion_size;

  const handleAdd = () => {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 800);
    // Haptic feedback if supported
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  return (
    <Card className="group overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
      {/* Image → detail sheet */}
      <Dialog>
        <DialogTrigger className="relative block w-full aspect-[4/3] bg-muted overflow-hidden shrink-0 cursor-pointer group-hover:bg-muted/70 transition-colors text-4xl">
          {p.image_url ? (
            <Image src={p.image_url} alt={name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center opacity-30">
              🍽️
            </span>
          )}
          {p.featured && (
            <Badge className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shadow-sm gap-1">
              <Star className="h-2.5 w-2.5" fill="currentColor" /> {lang === "en" ? "Featured" : "Destacado"}
            </Badge>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="h-3.5 w-3.5" />
          </span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div className="relative aspect-video w-full bg-muted">
            {p.image_url ? (
              <Image src={p.image_url} alt={name} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-30">🍽️</div>
            )}
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display font-bold text-xl leading-tight">{name}</h3>
              <p className="text-primary font-bold text-xl tabular-nums shrink-0">${p.price.toFixed(2)}</p>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t!.value} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${t!.className}`}>
                    {t!.emoji} {lang === "en" ? t!.label_en : t!.label}
                  </span>
                ))}
              </div>
            )}
            {desc && <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>}
            {(p.calories || p.portion_size) && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                {p.calories ? <span><strong className="text-foreground">{p.calories}</strong> kcal</span> : null}
                {p.portion_size ? <span>{p.portion_size}</span> : null}
              </div>
            )}
            {p.allergens && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-2.5 py-1.5">
                ⚠️ {lang === "en" ? "Allergens" : "Alérgenos"}: {p.allergens}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex-1">
          <div className="flex items-start gap-1">
            <p className="font-display font-semibold text-sm leading-snug flex-1">{name}</p>
          </div>
          {/* Tag badges (emoji compactos) */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.slice(0, 3).map((t) => (
                <span key={t!.value} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${t!.className}`} title={lang === "en" ? t!.label_en : t!.label}>
                  {t!.emoji}
                </span>
              ))}
            </div>
          )}
          {desc && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {desc}
              {hasDetail && <span className="text-primary"> · {lang === "en" ? "more" : "ver más"}</span>}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="font-display text-primary font-bold text-base tabular">${p.price.toFixed(2)}</p>
          {readOnly ? null : cartItem && !hasModifiers ? (
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-background shadow-sm" onClick={onDec}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center text-xs font-bold">{cartItem.quantity}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-background shadow-sm" onClick={onInc}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className={`h-7 text-xs text-white px-2.5 transition-all active:scale-90 ${
                justAdded ? "bg-green-500 hover:bg-green-500" : "bg-primary hover:bg-primary/90"
              }`}
              onClick={handleAdd}
            >
              {justAdded ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  {lang === "en" ? "Added" : "Agregado"}
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  {hasModifiers ? (lang === "en" ? "Choose" : "Elegir") : (lang === "en" ? "Add" : "Agregar")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
