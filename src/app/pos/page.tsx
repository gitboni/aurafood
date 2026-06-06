"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category, Product, CartItem, Order } from "@/lib/types";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Home,
  Search,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt } from "@/components/receipt";
import { toast } from "sonner";

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTable, setCustomerTable] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

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

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
      );
    }
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  const filtered = products.filter((p) => {
    const matchCategory = !activeCategory || p.category_id === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  async function submitOrder() {
    if (cart.length === 0) return;
    setSending(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName || null,
          customer_table: customerTable || null,
          status: "pending",
          total,
          notes: notes || null,
          source: "pos",
        })
        .select("*, order_items(*)")
        .single();

      if (orderError) throw orderError;

      const items = cart.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        subtotal: i.product.price * i.quantity,
        notes: i.notes || null,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("order_items")
        .insert(items)
        .select("*");
      if (itemsError) throw itemsError;

      const fullOrder: Order = { ...order, order_items: insertedItems };
      setReceiptOrder(fullOrder);

      toast.success(`Orden #${order.order_number} creada`);
      setCart([]);
      setCustomerName("");
      setCustomerTable("");
      setNotes("");
    } catch {
      toast.error("Error al crear la orden");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Receipt overlay */}
      {receiptOrder && (
        <Receipt order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

      {/* Left panel — Products */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}>
            <LogOut className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-orange-500" />
            POS — AuraFood
          </h1>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar producto..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </header>

        <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "outline"}
              size="sm"
              className={`shrink-0 ${activeCategory === cat.id ? "bg-orange-500 hover:bg-orange-600" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id);
              return (
                <Card
                  key={p.id}
                  className={`p-3 cursor-pointer hover:shadow-md transition-all ${inCart ? "ring-2 ring-orange-400" : ""}`}
                  onClick={() => addToCart(p)}
                >
                  {p.image_url && (
                    <div className="h-20 bg-muted rounded-md mb-2 overflow-hidden">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-orange-600 font-bold text-sm">${p.price.toFixed(2)}</span>
                    {inCart && <Badge className="bg-orange-500">{inCart.quantity}</Badge>}
                  </div>
                </Card>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No se encontraron productos</p>
          )}
        </ScrollArea>
      </div>

      {/* Right panel — Cart */}
      <div className="w-96 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Orden Actual</h2>
          <p className="text-sm text-muted-foreground">{count} items</p>
        </div>

        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Agrega productos a la orden</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-sm text-orange-600 font-semibold">${(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.product.id, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.product.id, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => updateQty(item.product.id, 0)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input placeholder="Mesa" value={customerTable} onChange={(e) => setCustomerTable(e.target.value)} />
          </div>
          <Textarea placeholder="Notas..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          <Separator />
          <div className="flex justify-between items-center text-xl font-bold">
            <span>Total</span>
            <span className="text-orange-600">${total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            size="lg"
            disabled={cart.length === 0 || sending}
            onClick={submitOrder}
          >
            {sending ? "Creando..." : `Crear Orden — $${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
