"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Category, Product, Order, ModifierGroup, SelectedModifier } from "@/lib/types";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Home,
  Search,
  LogOut,
  Loader2,
  AlertCircle,
  QrCode,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, type PaymentMethod } from "@/components/receipt";
import { buildKitchenTicket, autoPrintEscPos } from "@/lib/escpos";
import { BillingModal } from "@/components/billing-modal";
import { LowStockAlert } from "@/components/low-stock-alert";
import { ModifierPicker } from "@/components/modifier-picker";
import { ManagerPinDialog } from "@/components/manager-pin-dialog";
import { useCartStore, lineKeyOf, lineUnitPrice } from "@/lib/store";
import { queueOrder, flushQueue, queuedCount, onQueueChange } from "@/lib/offline-queue";
import { WifiOff, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from '@/components/theme-toggle';
import { useTenantId } from "@/lib/tenant-client";

type Tab = "sell" | "orders";

const QR_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  preparing: { label: "Preparando", color: "bg-blue-100 text-blue-800", icon: ChefHat },
  ready: { label: "Listo", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  delivered: { label: "Entregado", color: "bg-muted text-foreground", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", icon: XCircle },
};

const QR_FILTER_OPTS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: "delivered", label: "Entregados" },
];

export default function POSPage() {
  // ── Sell tab state ─────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTable, setCustomerTable] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("mesa") ?? "";
  });
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLookup, setCustomerLookup] = useState<{ name: string; total_orders: number; total_spent: number; loyalty_points: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [modGroups, setModGroups] = useState<Record<string, ModifierGroup[]>>({});
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [taxCfg, setTaxCfg] = useState({ enabled: false, rate: 0, inclusive: true });
  const [autoPrintKitchen, setAutoPrintKitchen] = useState(false);
  const [loyaltyCfg, setLoyaltyCfg] = useState({ enabled: false, pointsPerCurrency: 1 });
  const [orderType, setOrderType] = useState<"dine_in" | "takeout" | "delivery">("dine_in");
  const [pinTarget86, setPinTarget86] = useState<Product | null>(null);

  // ── Orders tab state ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("sell");
  const [qrOrders, setQrOrders] = useState<Order[]>([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrFilter, setQrFilter] = useState("all");
  // billingOrders: [] = no billing open, [order] = single, [o1,o2…] = mesa completa
  const [billingOrders, setBillingOrders] = useState<Order[]>([]);
  const [billingReceipt, setBillingReceipt] = useState<{
    paymentMethod: PaymentMethod;
    amountPaid?: number;
  } | null>(null);
  const qrChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { items, addItem, updateQuantity, clearCart, total, count } = useCartStore();
  const supabase = createClient();
  const { tenantId, error: tenantError, resolving: tenantResolving } = useTenantId();

  // Si el hook falla resolviendo el tenant, mostrar error claro
  useEffect(() => {
    if (tenantError) {
      setErrorProducts(true);
      setLoadingProducts(false);
    }
  }, [tenantError]);
  // Espera defensiva: si tras 5s el tenant sigue sin resolver, error
  useEffect(() => {
    if (!tenantResolving) return;
    const id = setTimeout(() => {
      if (tenantResolving) {
        setErrorProducts(true);
        setLoadingProducts(false);
      }
    }, 5000);
    return () => clearTimeout(id);
  }, [tenantResolving]);

  // ── Load products ───────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    async function load() {
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase.from("categories").select("*").eq("restaurant_id", tenantId).eq("active", true).order("sort_order"),
          supabase.from("products").select("*").eq("restaurant_id", tenantId).eq("available", true).order("sort_order"),
        ]);
        if (catRes.error) throw catRes.error;
        if (prodRes.error) throw prodRes.error;
        if (catRes.data) {
          setCategories(catRes.data);
          if (catRes.data.length > 0) setActiveCategory(catRes.data[0].id);
        }
        if (prodRes.data) setProducts(prodRes.data);
      } catch {
        setErrorProducts(true);
      } finally {
        setLoadingProducts(false);
      }
    }
    load();
    loadModifiers();
  }, [tenantId]);

  // ── Load modifier groups mapped per product ────────────────
  async function loadModifiers() {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("product_modifier_groups")
      .select("product_id, modifier_groups(*, modifiers(*))")
      .eq("restaurant_id", tenantId);
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

  // Add a product: open modifier picker if it has groups, else add directly
  function handleAddProduct(p: Product) {
    if (modGroups[p.id]?.length) setPickerProduct(p);
    else addItem(p);
  }

  // Mark a product as out of stock (86) — hides it from POS + menu
  async function markUnavailable(p: Product) {
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    const { error } = await supabase
      .from("products")
      .update({ available: false })
      .eq("id", p.id);
    if (error) {
      toast.error("No se pudo agotar");
      setProducts((prev) => [...prev, p].sort((a, b) => a.sort_order - b.sort_order));
    } else {
      toast.success(`${p.name} marcado como agotado`, {
        action: {
          label: "Deshacer",
          onClick: async () => {
            await supabase.from("products").update({ available: true }).eq("id", p.id);
            setProducts((prev) => [...prev, p].sort((a, b) => a.sort_order - b.sort_order));
          },
        },
      });
    }
  }

  // ── Load current open shift ─────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    async function loadShift() {
      const { data } = await supabase
        .from("shifts")
        .select("id")
        .eq("restaurant_id", tenantId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCurrentShiftId(data?.id ?? null);
    }
    loadShift();

    async function loadTaxCfg() {
      const { data } = await supabase
        .from("settings")
        .select("tax_enabled, tax_rate, tax_inclusive, auto_print_kitchen, loyalty_enabled, loyalty_points_per_currency")
        .eq("restaurant_id", tenantId)
        .maybeSingle();
      if (data) {
        setTaxCfg({
          enabled: !!data.tax_enabled,
          rate: Number(data.tax_rate) || 0,
          inclusive: data.tax_inclusive ?? true,
        });
        setAutoPrintKitchen(!!data.auto_print_kitchen);
        setLoyaltyCfg({
          enabled: !!data.loyalty_enabled,
          pointsPerCurrency: Number(data.loyalty_points_per_currency) || 1,
        });
      }
    }
    loadTaxCfg();
  }, [tenantId]);

  // ── Always-on alert for incoming QR orders (any tab) ───────
  useEffect(() => {
    const ch = supabase
      .channel("pos-qr-incoming")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: "source=eq.qr" },
        (payload) => {
          const o = payload.new as Order;
          try {
            const ctx = new (window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.25;
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
          } catch {}
          toast.info(
            `🔔 Nueva orden QR${o.customer_table ? ` — Mesa ${o.customer_table}` : ""}`,
            { duration: 6000 }
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Online/offline tracking + auto-sync queued orders ──────
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setPendingSync(queuedCount());

    async function trySync() {
      setIsOnline(navigator.onLine);
      setPendingSync(queuedCount());
      if (navigator.onLine && queuedCount() > 0) {
        const n = await flushQueue(supabase);
        if (n > 0) {
          toast.success(`${n} orden${n > 1 ? "es" : ""} sincronizada${n > 1 ? "s" : ""}`);
          setPendingSync(queuedCount());
        }
      }
    }

    const off = onQueueChange(trySync);
    trySync();
    const interval = setInterval(trySync, 15000);
    return () => { off(); clearInterval(interval); };
  }, []);

  // ── Warn before leaving with items in the cart ─────────────
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (items.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [items.length]);

  // ── Load QR orders when tab is active ──────────────────────
  async function loadQROrders() {
    if (!tenantId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", tenantId)
      .eq("source", "qr")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });
    if (data) setQrOrders(data);
    setQrLoading(false);
  }

  useEffect(() => {
    if (activeTab !== "orders") {
      if (qrChannelRef.current) {
        supabase.removeChannel(qrChannelRef.current);
        qrChannelRef.current = null;
      }
      return;
    }
    if (!tenantId) return;
    setQrLoading(true);
    loadQROrders();

    const ch = supabase
      .channel("pos-qr-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        loadQROrders()
      )
      .subscribe();
    qrChannelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      qrChannelRef.current = null;
    };
  }, [activeTab, tenantId]);

  // ── Sell helpers ────────────────────────────────────────────
  const subtotal = total();
  const orderCount = count();
  const discPct = Math.min(100, Math.max(0, parseFloat(discountPercent) || 0));
  const discountAmount = +(subtotal * (discPct / 100)).toFixed(2);
  const tip = Math.max(0, parseFloat(tipAmount) || 0);
  const taxableBase = +(subtotal - discountAmount).toFixed(2);
  // Tax added on top only when enabled AND exclusive mode
  const taxOnTop = taxCfg.enabled && !taxCfg.inclusive
    ? +(taxableBase * (taxCfg.rate / 100)).toFixed(2)
    : 0;
  const orderTotal = +(taxableBase + taxOnTop + tip).toFixed(2);
  const paid = parseFloat(amountPaid);

  const filtered = products.filter((p) => {
    const matchCategory = !activeCategory || p.category_id === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // ── CRM: lookup customer by phone ──────────────────────────
  async function lookupCustomer(phone: string) {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 7) { setCustomerLookup(null); setCustomerId(null); return; }
    const { data } = await supabase
      .from("customers")
      .select("id, name, total_orders, total_spent, loyalty_points")
      .eq("phone", clean)
      .maybeSingle();
    if (data) {
      setCustomerId(data.id);
      setCustomerLookup({
        name: data.name ?? "",
        total_orders: data.total_orders,
        total_spent: Number(data.total_spent),
        loyalty_points: Number(data.loyalty_points) || 0,
      });
      if (data.name && !customerName) setCustomerName(data.name);
    } else {
      setCustomerLookup(null);
      setCustomerId(null);
    }
  }

  async function submitOrder() {
    if (items.length === 0) return;
    setSending(true);

    // Upsert customer if phone present (skip when offline)
    let cId = customerId;
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length >= 7 && (typeof navigator === "undefined" || navigator.onLine)) {
      const { data } = await supabase
        .from("customers")
        .upsert({ phone: cleanPhone, name: customerName || null }, { onConflict: "phone" })
        .select("id, loyalty_points")
        .single();
      if (data?.id) {
        cId = data.id;
        // Accrue loyalty points
        if (loyaltyCfg.enabled) {
          const earned = Math.round(orderTotal * loyaltyCfg.pointsPerCurrency);
          if (earned > 0) {
            await supabase
              .from("customers")
              .update({ loyalty_points: (Number(data.loyalty_points) || 0) + earned })
              .eq("id", data.id);
            toast.success(`🎁 +${earned} puntos para ${customerName || "el cliente"}`);
          }
        }
      }
    }

    const locationId = typeof window !== "undefined"
      ? localStorage.getItem("aurafood-active-location") : null;

    // Build payloads once (reused for online insert and offline queue)
    const orderPayload = {
      customer_name: customerName || null,
      customer_phone: cleanPhone || null,
      customer_id: cId,
      location_id: locationId,
      customer_table: customerTable || null,
      status: "pending",
      subtotal,
      discount_percent: discPct,
      discount_amount: discountAmount,
      tip,
      total: orderTotal,
      payment_method: paymentMethod,
      order_type: orderType,
      shift_id: currentShiftId,
      notes: notes || null,
      source: "pos",
      restaurant_id: tenantId,
    };
    const baseItems = items.map((i) => {
      const unit = lineUnitPrice(i);
      const modNote = (i.modifiers ?? []).map((m) => m.modifier_name).join(", ");
      const fullNote = [modNote, i.notes].filter(Boolean).join(" · ");
      return {
        restaurant_id: tenantId,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: unit,
        subtotal: unit * i.quantity,
        notes: fullNote || null,
      };
    });
    const consumeList = items.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));

    function resetForm() {
      clearCart();
      setCustomerName("");
      setCustomerPhone("");
      setCustomerLookup(null);
      setCustomerId(null);
      setCustomerTable("");
      setNotes("");
      setAmountPaid("");
      setDiscountPercent("");
      setTipAmount("");
      setOrderType("dine_in");
    }

    // ── Offline: queue locally, sync on reconnect ──
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOrder({
        localId: crypto.randomUUID(),
        order: orderPayload,
        items: baseItems,
        consume: consumeList,
      });
      toast.success("Sin conexión: orden guardada, se enviará al reconectar", { duration: 6000 });
      resetForm();
      setSending(false);
      return;
    }

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select("*, order_items(*)")
        .single();

      if (orderError) throw orderError;

      const lineItems = baseItems.map((it) => ({ ...it, order_id: order.id }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("order_items")
        .insert(lineItems)
        .select("*");
      if (itemsError) throw itemsError;

      const fullOrder: Order = { ...order, order_items: insertedItems };
      setReceiptOrder(fullOrder);
      toast.success(`Orden #${order.order_number} creada`);

      // Auto-print kitchen comanda if enabled
      if (autoPrintKitchen) {
        try {
          const printed = await autoPrintEscPos(buildKitchenTicket(fullOrder));
          if (!printed) toast.info("Comanda lista — empareja la impresora en Ajustes");
        } catch { /* ignore print errors */ }
      }

      // Deduct inventory stock and check for low-stock alerts
      fetch("/api/inventory/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, items: consumeList }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.lowStock?.length > 0) {
            const names = data.lowStock
              .map((i: { name: string; stock: number; unit: string; min_stock: number }) =>
                `${i.name} (${i.stock.toFixed(0)} ${i.unit})`
              )
              .join(", ");
            toast.warning(`⚠️ Stock bajo: ${names}`, { duration: 8000 });
          }
        })
        .catch(() => {});
      resetForm();
    } catch {
      toast.error("Error al crear la orden");
    } finally {
      setSending(false);
    }
  }

  // ── QR orders helpers ───────────────────────────────────────
  const filteredQR =
    qrFilter === "all" ? qrOrders : qrOrders.filter((o) => o.status === qrFilter);

  const pendingCount = qrOrders.filter((o) =>
    ["pending", "ready"].includes(o.status)
  ).length;

  // Group filtered orders by table (null table → own bucket per order id)
  const tableGroups: { key: string; label: string; orders: Order[] }[] = [];
  const seen = new Set<string>();
  for (const order of filteredQR) {
    const key = order.customer_table ?? `__${order.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      tableGroups.push({
        key,
        label: order.customer_table ? `Mesa ${order.customer_table}` : "Sin mesa",
        orders: filteredQR.filter(
          (o) => (o.customer_table ?? `__${o.id}`) === key
        ),
      });
    }
  }

  // Merge multiple orders into one virtual receipt
  function mergeOrders(orders: Order[]): Order {
    if (orders.length === 1) return orders[0];
    return {
      ...orders[0],
      customer_name: null,
      total: orders.reduce((s, o) => s + Number(o.total), 0),
      notes: null,
      order_items: orders.flatMap((o) => o.order_items ?? []),
    };
  }

  // Close billing receipt: mark as delivered + remove from list
  async function closeBillingReceipt() {
    if (billingOrders.length > 0) {
      const ids = billingOrders.map((o) => o.id);
      const activeIds = billingOrders
        .filter((o) => !["delivered", "cancelled"].includes(o.status))
        .map((o) => o.id);
      if (activeIds.length > 0) {
        await supabase
          .from("orders")
          .update({ status: "delivered" })
          .in("id", activeIds);
      }
      setQrOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
    }
    setBillingOrders([]);
    setBillingReceipt(null);
  }

  // ── Loading / error ──────────────────────────────────────────
  if (loadingProducts) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorProducts) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-muted gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold">No se pudo cargar el menú</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-muted">
      {/* Modifier picker */}
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

      {/* Receipt overlay */}
      {receiptOrder && (
        <Receipt
          order={receiptOrder}
          paymentMethod={paymentMethod}
          amountPaid={paymentMethod === "cash" && amountPaid ? paid : undefined}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Manager PIN before marking a product as out of stock (86) */}
      {pinTarget86 && (
        <ManagerPinDialog
          action={`marcar "${pinTarget86.name}" como agotado`}
          onSuccess={() => {
            const p = pinTarget86;
            setPinTarget86(null);
            if (p) markUnavailable(p);
          }}
          onClose={() => setPinTarget86(null)}
        />
      )}

      {/* Billing modal for QR orders */}
      {billingOrders.length > 0 && !billingReceipt && (
        <BillingModal
          order={mergeOrders(billingOrders)}
          onClose={() => setBillingOrders([])}
          onPrint={(method, amount) =>
            setBillingReceipt({ paymentMethod: method, amountPaid: amount })
          }
        />
      )}

      {/* Factura — rendered at POS root so it's always on top */}
      {billingOrders.length > 0 && billingReceipt && (
        <Receipt
          order={mergeOrders(billingOrders)}
          paymentMethod={billingReceipt.paymentMethod}
          amountPaid={billingReceipt.amountPaid}
          onClose={closeBillingReceipt}
        />
      )}

      {/* ── Header ── */}
      <header className="bg-card border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <Home className="h-5 w-5" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <ThemeToggle />

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab("sell")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "sell"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingBag className="h-4 w-4" /> Vender
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "orders"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="h-4 w-4" /> Órdenes QR
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === "sell" && (
          <>
            <h1 className="text-lg font-bold text-foreground hidden md:flex items-center gap-1.5">
              <ShoppingBag className="h-5 w-5 text-primary" /> POS — El Buen Comer
            </h1>
            {!isOnline && (
              <span className="flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                <WifiOff className="h-3.5 w-3.5" /> Sin conexión
              </span>
            )}
            {pendingSync > 0 && (
              <span className="flex items-center gap-1.5 bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                <CloudUpload className="h-3.5 w-3.5" /> {pendingSync} por enviar
              </span>
            )}
            <LowStockAlert />
            <div className="flex-1" />
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </>
        )}

        {activeTab === "orders" && (
          <>
            <h1 className="text-lg font-bold text-foreground">Órdenes del día — QR</h1>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={loadQROrders}>
              Actualizar
            </Button>
          </>
        )}
      </header>

      {/* ══════════════════════════════════════
          TAB: VENDER
      ══════════════════════════════════════ */}
      {activeTab === "sell" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: products */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category pills */}
            <div className="bg-card border-b px-4 py-2 flex gap-2 overflow-x-auto shrink-0">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  className={`shrink-0 ${
                    activeCategory === cat.id ? "bg-primary hover:bg-primary/90" : ""
                  }`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filtered.map((p) => {
                  const inCart = items.find((i) => i.product.id === p.id);
                  const hasMods = !!modGroups[p.id]?.length;
                  const initial = p.name.trim().charAt(0).toUpperCase();
                  return (
                    <Card
                      key={p.id}
                      className={`group cursor-pointer overflow-hidden transition-all duration-200 relative p-0 hover:shadow-lg hover:-translate-y-0.5 ${
                        inCart ? "ring-2 ring-primary shadow-md" : ""
                      }`}
                      onClick={() => handleAddProduct(p)}
                    >
                      {/* Square image / fallback */}
                      <div className="relative aspect-square w-full bg-muted overflow-hidden">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 200px"
                            className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                            <span className="text-5xl font-bold opacity-80">{initial}</span>
                          </div>
                        )}

                        {/* Top-left: 86 (out of stock) */}
                        <button
                          type="button"
                          title="Marcar agotado (86)"
                          className="absolute top-1.5 left-1.5 z-10 h-6 w-6 rounded-full bg-card/80 hover:bg-destructive hover:text-white text-muted-foreground text-[10px] font-bold flex items-center justify-center backdrop-blur-sm transition-colors shadow-sm"
                          onClick={(e) => { e.stopPropagation(); setPinTarget86(p); }}
                        >
                          86
                        </button>

                        {/* Top-right: modifier indicator */}
                        {hasMods && (
                          <span className="absolute top-1.5 right-1.5 z-10 text-[9px] bg-blue-500/90 text-white px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm shadow-sm">
                            opciones
                          </span>
                        )}

                        {/* Bottom-right: in-cart quantity badge (large, prominent) */}
                        {inCart && (
                          <div className="absolute bottom-1.5 right-1.5 z-10 h-7 min-w-7 px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg ring-2 ring-white">
                            {inCart.quantity}
                          </div>
                        )}
                      </div>

                      {/* Name + price */}
                      <div className="p-2.5">
                        <p className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</p>
                        <p className="text-primary font-bold text-base mt-1">
                          ${p.price.toFixed(2)}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-12">
                  No se encontraron productos
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Right: cart */}
          <div className="w-96 bg-card border-l flex flex-col overflow-hidden">
            <div className="p-4 border-b shrink-0">
              <h2 className="font-bold text-lg">Orden Actual</h2>
              <p className="text-sm text-muted-foreground">{orderCount} items</p>
            </div>

            <ScrollArea className="flex-1 min-h-0 p-4">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Agrega productos a la orden
                </p>
              ) : (
                <div className="space-y-3">
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
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 shrink-0"
                          onClick={() => updateQuantity(key, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold shrink-0">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 shrink-0"
                          onClick={() => addItem(item.product, item.modifiers)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => updateQuantity(key, 0)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer: form scrolls, total + button always pinned */}
            <div className="border-t shrink-0 flex flex-col min-h-0 max-h-[62%] bg-card">
            <div className="overflow-y-auto p-4 space-y-3">
              {/* Order type selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "dine_in", label: "🍽️ Aquí" },
                  { v: "takeout", label: "🥡 Llevar" },
                  { v: "delivery", label: "🛵 Delivery" },
                ] as const).map((opt) => (
                  <Button
                    key={opt.v}
                    type="button"
                    variant={orderType === opt.v ? "default" : "outline"}
                    size="sm"
                    className={orderType === opt.v ? "bg-primary hover:bg-primary/90" : ""}
                    onClick={() => setOrderType(opt.v)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Input
                  placeholder="Mesa"
                  value={customerTable}
                  onChange={(e) => setCustomerTable(e.target.value)}
                />
              </div>
              <Input
                placeholder="Teléfono (opcional)"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  lookupCustomer(e.target.value);
                }}
              />
              {customerLookup && (
                <div className="flex items-center justify-between text-xs bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1.5">
                  <span className="text-primary font-medium">
                    🌟 {customerLookup.name || "Cliente frecuente"}
                  </span>
                  <span className="text-primary/80 tabular-nums">
                    {customerLookup.total_orders} órdenes
                    {loyaltyCfg.enabled && ` · ${customerLookup.loyalty_points} pts`}
                  </span>
                </div>
              )}
              <Textarea
                placeholder="Notas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />

              {/* Payment method */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Forma de Pago
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: "cash", label: "Efectivo", emoji: "💵" },
                      { value: "card", label: "Tarjeta", emoji: "💳" },
                      { value: "transfer", label: "Transfer.", emoji: "📱" },
                    ] as { value: PaymentMethod; label: string; emoji: string }[]
                  ).map((pm) => (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                        paymentMethod === pm.value
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      <span className="text-base">{pm.emoji}</span>
                      {pm.label}
                    </button>
                  ))}
                </div>
                {paymentMethod === "cash" && (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      placeholder="Monto recibido"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      step="0.01"
                      min={0}
                    />
                    {paid > 0 && paid >= orderTotal && (
                      <div className="flex justify-between text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                        <span>Cambio:</span>
                        <span>${(paid - orderTotal).toFixed(2)}</span>
                      </div>
                    )}
                    {paid > 0 && paid < orderTotal && (
                      <p className="text-xs text-destructive">
                        Falta: ${(orderTotal - paid).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Discount + tip */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Descuento %
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Propina $
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

            </div>

            {/* Pinned: breakdown + action button (always visible) */}
            <div className="p-4 pt-3 border-t shrink-0 space-y-2 bg-card">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({discPct}%)</span>
                    <span>−${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxOnTop > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>ITBIS ({Number(taxCfg.rate)}%)</span>
                    <span>+${taxOnTop.toFixed(2)}</span>
                  </div>
                )}
                {tip > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Propina</span>
                    <span>+${tip.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">${orderTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white"
                size="lg"
                disabled={items.length === 0 || sending}
                onClick={submitOrder}
              >
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {sending ? "Creando..." : `Crear Orden — $${orderTotal.toFixed(2)}`}
              </Button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: ÓRDENES QR
      ══════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Filter bar */}
          <div className="bg-card border-b px-4 py-2 flex gap-2 overflow-x-auto shrink-0">
            {QR_FILTER_OPTS.map((f) => {
              const count =
                f.value === "all"
                  ? qrOrders.length
                  : qrOrders.filter((o) => o.status === f.value).length;
              return (
                <Button
                  key={f.value}
                  variant={qrFilter === f.value ? "default" : "outline"}
                  size="sm"
                  className={`shrink-0 ${
                    qrFilter === f.value ? "bg-primary hover:bg-primary/90" : ""
                  }`}
                  onClick={() => setQrFilter(f.value)}
                >
                  {f.label}
                  <span className="ml-1.5 text-xs opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>

          {qrLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredQR.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <QrCode className="h-12 w-12 opacity-30" />
              <p className="font-medium">No hay órdenes QR{qrFilter !== "all" ? " con este estado" : " hoy"}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                {tableGroups.map((group) => {
                  const groupTotal = group.orders.reduce(
                    (s, o) => s + Number(o.total),
                    0
                  );
                  const isMulti = group.orders.length > 1;
                  return (
                    <div key={group.key}>
                      {/* Table group header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base">{group.label}</h3>
                          {isMulti && (
                            <Badge variant="outline" className="text-xs">
                              {group.orders.length} cuentas
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isMulti && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5 text-xs"
                              onClick={() => setBillingOrders(group.orders)}
                            >
                              <ReceiptText className="h-3.5 w-3.5" />
                              Cobrar Mesa — ${groupTotal.toFixed(2)}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Order cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {group.orders.map((order) => {
                          const st = QR_STATUS[order.status] ?? QR_STATUS.pending;
                          const StatusIcon = st.icon;
                          return (
                            <Card key={order.id} className="overflow-hidden">
                              <CardContent className="p-0">
                                {/* Card header */}
                                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                                  <span className="text-xl font-extrabold">
                                    #{order.order_number}
                                  </span>
                                  <Badge
                                    className={`${st.color} flex items-center gap-1 border-0 text-xs`}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {st.label}
                                  </Badge>
                                </div>

                                {/* Customer + time */}
                                <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground">
                                  {order.customer_name && (
                                    <span>{order.customer_name}</span>
                                  )}
                                  <span>
                                    {new Date(order.created_at).toLocaleTimeString(
                                      "es",
                                      { hour: "2-digit", minute: "2-digit" }
                                    )}
                                  </span>
                                </div>

                                <Separator />

                                {/* Items */}
                                <div className="px-4 py-2 space-y-1">
                                  {order.order_items?.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex justify-between text-sm"
                                    >
                                      <span>
                                        <span className="font-semibold text-primary">
                                          {item.quantity}x
                                        </span>{" "}
                                        {item.product_name}
                                      </span>
                                      <span className="tabular-nums">
                                        ${Number(item.subtotal).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                  {order.notes && (
                                    <p className="text-xs text-yellow-700 bg-yellow-50 p-1.5 rounded mt-1 italic">
                                      📝 {order.notes}
                                    </p>
                                  )}
                                </div>

                                <Separator />

                                {/* Footer */}
                                <div className="flex items-center justify-between px-4 py-2">
                                  <span className="font-bold text-primary">
                                    ${Number(order.total).toFixed(2)}
                                  </span>
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-white gap-1.5"
                                    onClick={() => setBillingOrders([order])}
                                  >
                                    <ReceiptText className="h-4 w-4" />
                                    Factura
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
